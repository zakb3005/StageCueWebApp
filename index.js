const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

const model = require('./model');
const Story = model.Story;
const User = model.User;

const s3 = new S3Client({
    region: "us-west-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function deleteS3File(fileUrl) {
    if (!fileUrl) return;

    const bucketName = "stagecue-images";
    const fileKey = fileUrl.split(`${bucketName}.s3.us-west-1.amazonaws.com/`)[1];

    if (!fileKey) {
        console.warn("Invalid S3 file URL:", fileUrl);
        return;
    }

    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileKey
        }));
        console.log("Deleted from S3:", fileKey);
    } catch (err) {
        console.error("Error deleting from S3:", err);
    }
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2 mb
});

const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use(cors({
    origin: 'https://s25-midterm-project-zakb3005-production.up.railway.app',
    credentials: true
}));

app.use(session({
    secret: process.env.SESSION_SECRET || "fallback-secret-key",
    saveUninitialized: false,
    resave: false,
    cookie: { 
        secure: process.env.NODE_ENV === "production",
        httpOnly: false,
        sameSite: "lax"
    }
}));

function authorizeUser(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.sendStatus(401);
    }
}

app.post('/users', (req, res) => {
    let errors = [];

    if (!req.body.email || !req.body.username || !req.body.plainPassword) {
        errors.push("All fields are required.");
    }
    if (req.body.username && (req.body.username.length < 3 || req.body.username.length > 20)) {
        errors.push("Username must be between 3 and 20 characters.");
    }
    if (req.body.plainPassword && req.body.plainPassword.length < 6) {
        errors.push("Password must be at least 6 characters long.");
    }
    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
        errors.push("Invalid email format.");
    }

    let newUser = new User({
        email: req.body.email,
        username: req.body.username
    });

    newUser.setEncryptedPassword(req.body.plainPassword).then(() => {
        newUser.save().then(() => {
            res.status(201).json({ success: true, message: "Account created successfully!" });
        }).catch((error) => {
            if (error.code === 11000) {
                if (error.keyPattern.email) {
                    errors.push("An account with this email already exists.");
                }
                if (error.keyPattern.username) {
                    errors.push("This username is already taken.");
                }
            }
            res.status(422).json({ errors });
        });
    });
});

app.get('/session', (req, res) => {
    console.log("Current session data:", req.session);

    if (req.session.userId) {
        User.findById(req.session.userId)
            .select("-encryptedPassword")
            .then(user => user ? res.json(user) : res.sendStatus(401))
            .catch(() => res.sendStatus(500));
    } else {
        res.sendStatus(401);
    }
});

app.post('/session', (req, res) => {
    User.findOne({ email: req.body.email })
        .then(user => {
            if (!user) {
                return res.status(401).json({ errors: ["No account with this email exists."] });
            }
            user.verifyEncryptedPassword(req.body.plainPassword).then(verified => {
                if (verified) {
                    req.session.userId = user._id;
                    res.json({ id: user._id, email: user.email, username: user.username });
                } else {
                    res.status(401).json({ errors: ["Incorrect password."] });
                }
            });
        })
        .catch(() => {
            res.status(500).json({ errors: ["An error occurred while logging in."] });
        });
});

app.put('/users/bio', authorizeUser, (req, res) => {
    const userId = req.session.userId;
    const newBio = req.body.bio;

    if (!newBio || newBio.length > 500) {
        return res.status(400).json({ error: "Bio must be between 1 and 500 characters." });
    }

    User.findByIdAndUpdate(userId, { bio: newBio }, { new: true })
        .select("-encryptedPassword")
        .then(updatedUser => updatedUser ? res.json(updatedUser) : res.status(404).json({ error: "User not found." }))
        .catch(err => {
            console.error("Error updating bio:", err);
            res.status(500).json({ error: "An error occurred while updating bio." });
        });
});

app.delete('/session', (req, res) => {
    req.session.userId = null;
    res.sendStatus(200);
});

app.post('/users/profile-pic', authorizeUser, upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        await deleteS3File(user.profilePicUrl);

        const fileKey = `profile_pics/${Date.now()}-${req.file.originalname}`;
        const bucketName = "stagecue-images";

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }));

        const imageUrl = `https://${bucketName}.s3.us-west-1.amazonaws.com/${fileKey}`;

        user.profilePicUrl = imageUrl;
        await user.save();

        res.json(user);
    } catch (err) {
        console.error("Error uploading to S3:", err);
        res.status(500).json({ error: "Image upload failed." });
    }
});

app.post("/stories", authorizeUser, async (req, res) => {
    try {
        const creator = await User.findById(req.session.userId);
        const newStory = new Story({
            title: req.body.title || "Untitled",
            description: req.body.description || "",
            creatorId: req.session.userId,
            creatorUser: creator.username
        });
        await newStory.save();
        res.status(201).json(newStory);
    } catch (err) {
        console.error("Error creating story:", err);
        res.sendStatus(500);
    }
});

app.post('/stories/:storyId/pages', authorizeUser, upload.single('pageImage'), async (req, res) => {
    try {
        const storyId = req.params.storyId;
        const story = await Story.findById(storyId);
        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        if (story.creatorId.toString() !== req.session.userId) {
            return res.status(403).json({ error: "Not authorized to add pages to this story." });
        }

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded for page." });
        }
        const fileKey = `storyPages/${Date.now()}-${req.file.originalname}`;
        const bucketName = "stagecue-images";

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }));

        const pageImageUrl = `https://${bucketName}.s3.us-west-1.amazonaws.com/${fileKey}`;

        story.pages.push({ imageUrl: pageImageUrl });
        await story.save();

        res.json(story);
    } catch (err) {
        console.error("Error adding page:", err);
        res.status(500).json({ error: "Failed to add page to story." });
    }
});

app.put('/stories/:storyId/thumbnail', authorizeUser, upload.single('thumbnail'), async (req, res) => {
    try {
        const storyId = req.params.storyId;
        const story = await Story.findById(storyId);
        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        if (story.creatorId.toString() !== req.session.userId) {
            return res.status(403).json({ error: "Not authorized to update this story's thumbnail." });
        }

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded for thumbnail." });
        }

        const fileKey = `thumbnails/${Date.now()}-${req.file.originalname}`;
        const bucketName = "stagecue-images";

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }));

        const thumbnailUrl = `https://${bucketName}.s3.us-west-1.amazonaws.com/${fileKey}`;

        story.thumbnailUrl = thumbnailUrl;
        await story.save();

        res.json({ message: "Thumbnail updated successfully", story });
    } catch (err) {
        console.error("Error updating thumbnail:", err);
        res.status(500).json({ error: "Failed to update story thumbnail." });
    }
});

app.get("/stories/top", async (req, res) => {
    try {
        const stories = await Story.find({})
            .sort({ averageRating: -1 })
            .limit(5);
        res.json(stories);
    } catch (err) {
        console.error("Error fetching top stories:", err);
        res.status(500).json({ error: "Failed to fetch top stories." });
    }
});

app.put('/stories/:storyId', authorizeUser, async (req, res) => {
    try {
        const storyId = req.params.storyId;
        const story = await Story.findById(storyId);

        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        if (story.creatorId.toString() !== req.session.userId) {
            return res.status(403).json({ error: "Not authorized to update this story's info." });
        }

        const { title, description } = req.body;

        if (!title || title.length < 1 || title.length > 24) {
            return res.status(422).json({ error: "Title length must be between 1 and 24 characters." });
        }

        if (description && description.length > 2000) {
            return res.status(422).json({ error: "Description must not exceed 2000 characters." });
        }

        story.title = title;
        story.description = description;
        
        await story.save();

        res.json(story);
    } catch (err) {
        console.error("Error updating story:", err);
        res.status(500).json({ error: "Failed to update story." });
    }
});

app.get('/users/:userId/stories', async (req, res) => {
    try {
        const userId = req.params.userId;
        const stories = await Story.find({ creatorId: userId }).sort({ _id: -1 });

        res.json(stories);
    } catch (err) {
        console.error("Error fetching user stories:", err);
        res.status(500).json({ error: "Failed to fetch user stories." });
    }
});

app.post("/stories/:storyId/rate", authorizeUser, async (req, res) => {
    try {
        const { storyId } = req.params;
        let { rating } = req.body;
        const userId = req.session.userId;

        rating = Number(rating);
        if (isNaN(rating) || rating < 0 || rating > 10) {
            return res.status(400).json({ error: "Rating must be a valid number between 0 and 10." });
        }

        const story = await Story.findById(storyId);
        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        const existingRating = story.ratings.find(r => r.userId.toString() === userId);

        if (existingRating) {
            existingRating.score = rating;
        } else {
            story.ratings.push({ userId, score: rating });
        }

        const total = story.ratings.reduce((sum, r) => sum + r.score, 0);
        story.averageRating = Number((total / story.ratings.length).toFixed(1));

        await story.save();
        res.json(story);
    } catch (err) {
        console.error("Error updating rating:", err);
        res.status(500).json({ error: "Failed to update rating." });
    }
});

app.get("/stories", async (req, res) => {
    try {
        const stories = await Story.find({});
        res.json(stories);
    } catch (err) {
        console.error("Error fetching stories:", err);
        res.status(500).json({ error: "Failed to fetch stories." });
    }
});

app.get("/stories/:storyId", async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        res.json(story);
    } catch (err) {
        console.error("Error fetching story:", err);
        res.status(500).json({ error: "Failed to fetch story." });
    }
});

app.put("/stories/:storyId/viewCount", async (req, res) => {
    try {
        const storyId = req.params.storyId;
        const story = await Story.findById(storyId);

        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        story.viewCount += 1;

        await story.save();

        res.json(story);
    } catch (err) {
        console.error("Error increasing views:", err);
        res.status(500).json({ error: "Failed to increase story views." });
    }
});

app.delete("/stories/:storyId", authorizeUser, async (req, res) => {
    try {
        const storyId = req.params.storyId;
        const story = await Story.findById(storyId);

        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        if (story.creatorId.toString() !== req.session.userId) {
            return res.status(403).json({ error: "Not authorized to delete this story." });
        }

        await deleteS3File(story.thumbnailUrl);

        for (const page of story.pages) {
            await deleteS3File(page.imageUrl);
        }

        await Story.findByIdAndDelete(storyId);

        res.json({ message: "Story deleted successfully." });
    } catch (err) {
        console.error("Error deleting story:", err);
        res.status(500).json({ error: "Failed to delete story." });
    }
});

app.delete('/stories/:storyId/pages', authorizeUser, async (req, res) => {
    try {
        const { storyId } = req.params;
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: "Image URL is required for deletion." });
        }

        const story = await Story.findById(storyId);
        if (!story) {
            return res.status(404).json({ error: "Story not found." });
        }

        if (story.creatorId.toString() !== req.session.userId) {
            return res.status(403).json({ error: "Not authorized to delete this page." });
        }

        const fileKey = imageUrl.split(".com/")[1];

        await s3.send(new DeleteObjectCommand({
            Bucket: "stagecue-images",
            Key: fileKey
        }));

        story.pages = story.pages.filter(page => page.imageUrl !== imageUrl);
        await story.save();

        res.json(story);
    } catch (err) {
        console.error("Error deleting page:", err);
        res.status(500).json({ error: "Failed to delete page." });
    }
});

app.listen(8080, () => {
    console.log("Server ready. Listening on port 8080");
});