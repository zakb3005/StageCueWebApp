# StageCue: Backend API Documentation

## Overview

StageCue is an application for hosting user-created stories from the StageCue client application. This backend provides a complete set of RESTful API endpoints to handle:

- User authentication (sign up, login, logout)  
- User profile management (bio and profile picture)  
- Story creation, editing, and deletion  
- AWS S3 integration for storing images (profile pictures, story pages, thumbnails)  

Below, you will find:

1. [Application URLs / Wireframe URLs](#1-urls)  
2. [Data Models / Schemas](#2-data-models--schemas)  
3. [Endpoints](#3-endpoints)

---

## 1. URLs

### Application URLs

- **Client**: [https://s25-midterm-project-zakb3005-production.up.railway.app](https://s25-midterm-project-zakb3005-production.up.railway.app)  
- **Server**: Hosted on the same Railway project (port 8080).

### Wireframe URLs

- **Low/High Fidelity Wireframes**: [Figma Wireframes](https://www.figma.com/design/8WjfxlZJl1EhOtfv46DscF/Untitled?node-id=0-1&t=Ehz8XQHUdbSktyzG-1)  
- **Storyboard/Prototype**: [Figma Prototype](https://www.figma.com/proto/8WjfxlZJl1EhOtfv46DscF/Untitled?node-id=32-592&p=f&t=Ehz8XQHUdbSktyzG-0&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=32%3A592)

---

## 2. Data Models / Schemas

### User Model

| Field               | Type     | Description                                                                                       |
|---------------------|----------|---------------------------------------------------------------------------------------------------|
| **email**           | String   | **Required**, unique, user’s email address. Validated for proper email format.                    |
| **username**        | String   | **Required**, unique, user’s display name (3 to 20 characters).                                   |
| **encryptedPassword** | String | The password hash stored in the database (never returned in responses).                          |
| **bio**             | String   | A short biography text (up to **300** characters).                                                |
| **profilePicUrl**   | String   | URL to the user’s profile picture stored in AWS S3.                                              |

### Story Model

| Field           | Type                           | Description                                                                                                    |
|-----------------|--------------------------------|----------------------------------------------------------------------------------------------------------------|
| **title**       | String                         | **Required**, story title (1 to 24 characters).                                                                |
| **description** | String                         | Optional, up to 2000 characters.                                                                               |
| **creatorId**   | ObjectId (ref `User`)          | **Required**, ID of the user who created the story.                                                            |
| **creatorUser** | String                         | The username of the creator (cached for easy display).                                                         |
| **thumbnailUrl**| String                         | URL to the story’s thumbnail in AWS S3.                                                                        |
| **pages**       | Array of Objects               | Each page object has an `imageUrl` for the uploaded page image.                                               |
| **ratings**     | Array of Objects               | Each rating object has a `userId` and `score` (0–10).                                                          |
| **averageRating** | Number                       | The average rating (calculated each time a user rates a story).                                               |
| **viewCount**   | Number                         | Tracks how many times the story has been viewed.                                                               |

---

## 3. Endpoints

### 3.1 Authentication & Session

#### **POST** `/users`
Create a new user account.

#### **POST** `/session`
Log in (create a session).

#### **GET** `/session`
Check if a user is logged in.

#### **DELETE** `/session`
Log out.

---

### 3.2 User Profile

#### **PUT** `/users/bio`
Update the current user’s bio (max **300** characters).

#### **POST** `/users/profile-pic`
Upload/update the user’s profile picture (AWS S3).

---

### 3.3 Stories

#### **POST** `/stories`
Create a new story.

#### **PUT** `/stories/:storyId`
Update a story’s title or description.

#### **DELETE** `/stories/:storyId`
Delete a story and all associated images.

#### **GET** `/stories`
Fetch all stories.

#### **GET** `/stories/:storyId`
Fetch a specific story.

#### **PUT** `/stories/:storyId/viewCount`
Increment a story’s view count.

#### **POST** `/stories/:storyId/rate`
Rate a story (0-10 scale).

#### **GET** `/stories/top`
Fetch the top 5 stories by rating.

#### **GET** `/users/:userId/stories`
Fetch all stories created by a user.

---

### 3.4 Story Images

#### **POST** `/stories/:storyId/pages`
Upload a page image.

#### **PUT** `/stories/:storyId/thumbnail`
Upload/update the story’s thumbnail.

#### **DELETE** `/stories/:storyId/pages`
Delete a specific page from a story.

---

**Author**:  
[**Zak Breitenstein**](https://github.com/zakb3005) – SE4200 Midterm Project  