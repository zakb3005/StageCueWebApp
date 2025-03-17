Vue.createApp({
    data: function () {
        return {
            page: '',
            searchQuery: "",
			stories: [],

            emailEntry: '',
            passwordEntry: '',
            usernameEntry: '',
            user: null,
            authErrors: [],

            visitingUser: null,
            userStories: [],
            editingProfile: false,

            topStories: [],
            carouselIndex: 0,
            carouselFading: false,

            editStory: {
                _id: null,
                title: "",
                description: "",
                thumbnailUrl: "images/Placeholder.jpg",
                pages: []
            },
            confirmingDelete: false,

            viewStory: {
                title: "Loading...",
                description: "",
                thumbnailUrl: "images/Placeholder.jpg",
                creatorId: null,
                creatorUser: "Unknown",
                views: 0,
                averageRating: 0,
                pages: []
            },
            readingIndex: 0,
            userRating: 0
        };
    },

    computed: {
		filteredStories() {
            return this.stories.filter(story =>
                story.title.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        },

        filteredUserStories() {
			return this.userStories.filter(story =>
				story.title.toLowerCase().includes(this.searchQuery.toLowerCase())
			);
		},

        carouselStories() {
            if (this.topStories.length === 0) return [];
    
            const total = this.topStories.length;
            const prevIndex = (this.carouselIndex - 1 + total) % total;
            const nextIndex = (this.carouselIndex + 1) % total;
    
            return [
                this.topStories[prevIndex],
                this.topStories[this.carouselIndex],
                this.topStories[nextIndex],
            ];
        }
	},

    methods: {
        prevCarousel() {
            if (this.topStories.length === 0) return;
			this.carouselIndex = (this.carouselIndex - 1 + this.topStories.length) % this.topStories.length;
		},
		
        nextCarousel() {
            if (this.topStories.length === 0) return;
			this.carouselIndex = (this.carouselIndex + 1) % this.topStories.length;
		},

        prevPageExists() {
            return this.readingIndex - 1 >= 0;
        },

        nextPageExists() {
            if (this.viewStory.pages.length < 0) {
                return;
            }
            return this.readingIndex + 1 <= this.viewStory.pages.length-1;
        },

        pagePrev() {
            if (this.readingIndex - 1 >= 0) {
                this.readingIndex -= 1;
            }
        },

        pageNext() {
            if (this.viewStory.pages.length < 0) {
                return;
            }
            if (this.readingIndex + 1 <= this.viewStory.pages.length-1) {
                this.readingIndex += 1;
            }
        },

        gotoPage(page) {
            if (page == 'Story') {
                if (!this.viewStory || this.viewStory.pages.length < 1) {
                    return;
                }
            }

            this.carouselIndex = 0
            this.authErrors = []
            this.editingProfile = false
            this.readingIndex = 0
            this.confirmingDelete = false;

            if (page == 'Stories') {
                this.fetchStories();
            }

            if (page == 'Home' || page == 'Stories') {
                this.fetchTopStories();
            }
            
            if (page == 'Story') {
                if (this.viewStory) {
                    this.increaseViews();
                    this.setUserRating();
                }
            } else {
                this.userRating = 0;
            }

            this.checkSession();
            this.page = page;
        },

        toggleEditProfile() {
            this.editingProfile = !this.editingProfile;
        },

        numberWithCommas(num) {
            if (num == null || isNaN(num)) return "0";
            return num.toLocaleString();
        },
        
        signUp() {
            this.authErrors = [];
        
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: this.emailEntry,
                    username: this.usernameEntry,
                    plainPassword: this.passwordEntry
                }),
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        if (errorData.errors) {
                            this.authErrors = errorData.errors;
                        } else {
                            this.authErrors = ["Signup failed. Please try again."];
                        }
                        throw new Error("Signup failed");
                    });
                }
                return response.json();
            })
            .then(() => {
                this.authErrors = [];
                this.login();
            })
            .then(() =>{
                this.gotoPage('Home');
            })
            .catch(err => {
                if (err.message !== "Signup failed") {
                    console.error(err);
                }
            });
        },              

        login() {
            this.authErrors = [];
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: this.emailEntry,
                    plainPassword: this.passwordEntry
                }),
                credentials: 'include'
            })
            .then(response => response.ok ? response.json() : response.json().then(err => Promise.reject(err)))
            .then(() => {
                this.authErrors = [];
                this.checkSession();
            }).then(() => {
                this.gotoPage('Home');
            })
            .catch(err => {
                this.authErrors = err.errors || ["Login failed."]; 
            });
        },        

        checkSession() {
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/session", { credentials: 'include' })
            .then(response => response.ok ? response.json() : Promise.reject("Unauthorized"))
            .then(user => {
                console.log("User session found:", user);
                this.user = user;
            })
            .catch(() => {
                this.user = null;
            });
        },        

        logout() {
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/session", {
                method: "DELETE",
                credentials: 'include'
            })
            .then(() => {
                this.user = null;
                this.emailEntry = '';
                this.passwordEntry = '';
                this.usernameEntry = '';
                this.visitingUser = null;
                this.gotoPage('Home');
            });
        },

        visitProfile(user) {
            this.visitingUser = user;
            this.fetchUserStories();
            this.gotoPage('Profile');
        },

        updateUserBio() {
            if (!this.user) {
                this.authErrors = ["User is not logged in."];
                console.log("Not logged in");
                return;
            }
        
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/users/bio", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bio: this.visitingUser.bio }),
                credentials: "include"
            })
            .then(response => response.ok ? response.json() : response.json().then(err => Promise.reject(err)))
            .then(updatedUser => {
                this.user = updatedUser;
                this.editingProfile = false;
            })
            .catch(err => {
                console.error("Error updating bio:", err);
                this.authErrors = err.error ? [err.error] : ["Failed to update bio."];
            });
        },
        
        visitingOwnProfile() {
            return (this.user != null && this.visitingUser != null && this.visitingUser._id == this.user._id);
        },

        visitingOwnStory() {
            return (this.user != null && this.viewStory != null && this.viewStory.creatorId == this.user._id);
        },

        uploadProfilePic(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            const formData = new FormData();
            formData.append("profilePic", file);
        
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/users/profile-pic", {
                method: "POST",
                credentials: "include",
                body: formData
            })
            .then(response => response.ok ? response.json() : response.json().then(err => Promise.reject(err)))
            .then(updatedUser => {
                this.user = updatedUser;
            })
            .catch(err => {
                console.error("Error uploading profile picture:", err);
            });
        },

        createEmptyStory() {
            const newStory = {
                title: "Untitled",
                description: ""
            };

            fetch("s25-midterm-project-zakb3005-production.up.railway.app/stories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(newStory)
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(created => {
                console.log("Created new story:", created);
                this.editStory = created;
                this.gotoPage("Edit");
            })
            .catch(err => {
                console.error("Failed to create story:", err);
            });
        },

        gotoEditStory() {
            if (!this.user) {
                console.warn("Not logged in user");
                return;
            }

            if (!this.viewStory || !this.visitingOwnStory) {
                console.warn("View story not valid");
                return;
            }

            this.editStory = this.viewStory;
            this.gotoPage("Edit");
        },

        updateStory() {
            if (!this.editStory._id) {
                console.warn("Story not created yet. Something unexpected happened.");
                return;
            }

            if (this.editStory.title == "") {
                this.authErrors = ["Story must have a title."];
                return;
            } else {
                this.authErrors = [];
            }
            
            const url = `s25-midterm-project-zakb3005-production.up.railway.app/stories/${this.editStory._id}`;
            
            const body = {
                title: this.editStory.title,
                description: this.editStory.description
            };
            
            fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body)
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(storyData => {
                console.log("Updated story info:", storyData);
                
                this.editStory = {
                    _id: null,
                    title: "",
                    description: "",
                    thumbnailUrl: "",
                    pages: []
                },

                this.viewStory = storyData;
                this.gotoPage('StoryDetails');
            })
            .catch(err => {
                console.error("Error updating story text:", err);
            });
        },
      
        triggerStoryThumbnailInput() {
            this.$refs.storyThumbnailInput.click();
        },

        uploadStoryThumbnail(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            if (!this.editStory._id) {
                return;
            }
        
            const formData = new FormData();
            formData.append("thumbnail", file);
        
            fetch(`s25-midterm-project-zakb3005-production.up.railway.app/stories/${this.editStory._id}/thumbnail`, {
                method: "PUT",
                credentials: "include",
                body: formData
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(updated => {
                console.log("Updated story with new thumbnail:", updated);
                this.editStory.thumbnailUrl = updated.story.thumbnailUrl;
            })
            .catch(err => {
                console.error("Error uploading thumbnail:", err);
            });
        },        
      
        addEmptyPage() {
            this.editStory.pages.push({ imageUrl: null });
        },
      
        triggerPageFileSelect(pageIndex) {
            this.$refs.pageFileInputs[pageIndex].click();
        },

        uploadPageImage(event) {
            const file = event.target.files[0];
            if (!file) return;
      
            if (!this.editStory._id) {
                event.target.value = null;
                return;
            }
      
            const formData = new FormData();
            formData.append("pageImage", file);
      
            fetch(`s25-midterm-project-zakb3005-production.up.railway.app/${this.editStory._id}/pages`, {
                method: "POST",
                credentials: "include",
                body: formData
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(updated => {
                console.log("Updated story w/page:", updated);
                this.editStory = updated;
                event.target.value = null;
            })
            .catch(err => {
                console.error("Error adding page:", err);
            });
        },

        deletePage(page) {
            const pageIndex = this.editStory.pages.indexOf(page);
        
            if (pageIndex === -1) return;
        
            if (!page.imageUrl) {
                this.editStory.pages.splice(pageIndex, 1);
            } else {
                fetch(`s25-midterm-project-zakb3005-production.up.railway.app/stories/${this.editStory._id}/pages`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ imageUrl: page.imageUrl })
                })
                .then(res => res.ok ? res.json() : Promise.reject(res))
                .then(updatedStory => {
                    console.log("Page deleted successfully:", updatedStory);
                    this.editStory.pages = updatedStory.pages;
                })
                .catch(err => console.error("Error deleting page:", err));
            }
        },        

        fetchStories() {
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/stories", { credentials: "include" })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(data => {
                this.stories = data.map(story => ({
                    ...story,
                    views: story.views || 0,
                    averageRating: story.averageRating || 0
                }));
            })
            .catch(err => console.error("Error fetching stories:", err));
        },
    
        fetchStoryDetails() {
            fetch(`s25-midterm-project-zakb3005-production.up.railway.app/stories/${this.storyId}`, { credentials: "include" })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(data => {
                this.story = data;
                this.setUserRating();
            })
            .catch(err => console.error("Error fetching story:", err));
        },

        fetchTopStories() {
            fetch("s25-midterm-project-zakb3005-production.up.railway.app/stories/top", { credentials: "include" })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(data => {
                this.topStories = data.map(story => ({
                    ...story
                }));
            })
            .catch(err => console.error("Error fetching top stories:", err));
        },
    
        setUserRating() {
            if (!this.user || !this.viewStory || this.viewStory.ratings.length < 1) {
                return;
            }
            const userRating = this.viewStory.ratings.find(r => r.userId === this.user._id);
            this.userRating = userRating ? userRating.score : null;
        },
    
        submitRating() {
            let thisRating = this.userRating;

            if (thisRating < 0) {
                thisRating = 0;
            } else if (thisRating > 10) {
                thisRating = 10;
            }

            fetch(`s25-midterm-project-zakb3005-production.up.railway.app/stories/${this.viewStory._id}/rate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ rating: thisRating })
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(story => {
                this.viewStory = story
            })
            .catch(err => console.error("Error submitting rating:", err));
        },

        fetchUserStories() {
            if (!this.visitingUser) return;
        
            fetch(`s25-midterm-project-zakb3005-production.up.railway.app/users/${this.visitingUser._id}/stories`, { credentials: "include" })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(stories => {
                this.userStories = stories.map(story => ({
                    ...story,
                    views: story.views || 0,
                    averageRating: story.averageRating || 0
                }));
            })
            .catch(err => console.error("Error fetching user stories:", err));
        },
        
        viewStoryDetails(story) {
            this.viewStory = story;
            this.gotoPage('StoryDetails');
        },

        increaseViews() {
            fetch(`s25-midterm-project-zakb3005-production.up.railway.app/stories/${this.viewStory._id}/viewCount`, {
                method: "PUT",
                credentials: "include"
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(story => {
                this.viewStory = story
            })
            .catch(err => console.error("Error counting view:", err));
        },

        deleteStory() {
            if (!this.user || !this.editStory) {
                this.gotoPage('Home');
                return;
            }
            if (!this.confirmingDelete) {
                this.confirmingDelete = true;

                setTimeout(() => {
                    this.confirmingDelete = false;
                }, 3000);

                return;
            }
            this.confirmingDelete = false;
    
            fetch(`s25-midterm-project-zakb3005-production.up.railway.app/stories/${this.editStory._id}`, {
                method: "DELETE",
                credentials: "include"
            })
            .then(response => response.ok ? response.json() : Promise.reject(response))
            .then(() => {
                this.gotoPage('Home');
            })
            .catch(err => {
                console.error("Error deleting story:", err);
            });
        }
    },

    created: function () {
        this.gotoPage('Home')
    }
}).mount('#app');