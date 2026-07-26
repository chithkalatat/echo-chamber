# EchoChamber Free Deployment Guide

This guide walks you through deploying the EchoChamber chat application 100% free of cost using Vercel, Render, MongoDB Atlas, and Upstash Redis.

---

## Step 1: Create a Free MongoDB Database (MongoDB Atlas)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and sign up for a free account.
2. Create a new project and build a database choosing the **M0 Free Tier** (Shared Cluster).
3. Select a cloud provider (e.g., AWS) and region near your users.
4. Set up a database user with a password (make sure to write down the password).
5. In **Network Access**, add `0.0.0.0/0` (allow access from anywhere) so that Render can connect to your database.
6. Click **Connect** -> **Drivers** -> Copy the connection string. It will look like:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   *(Replace `<username>` and `<password>` with your created database credentials).*

---

## Step 2: Create a Free Redis Instance (Upstash)

1. Go to [Upstash Console](https://console.upstash.com/) and log in/register.
2. Click **Create Database**.
3. Set name as `echochamber` and choose your region.
4. Keep the **SSL** enabled option checked.
5. Once created, copy the **Redis URL** (`REDIS_URL`) from the dashboard under Node.js client or URL. It will look like:
   ```text
   redis://default:<password>@<endpoint>:<port>
   ```

---

## Step 3: Deploy the Backend to Render (Free Web Service)

1. Sign up/log in to [Render](https://render.com/).
2. Click **New** -> **Web Service**.
3. Connect your GitHub repository containing the EchoChamber code.
4. Set up the service details:
   - **Name:** `echo-chamber-backend`
   - **Region:** Choose a region close to your database cluster
   - **Runtime:** `Node`
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start` (Make sure to set Root Directory to `server`)
5. Scroll down to **Environment Variables** and add the following keys:
   - `MONGO_URI`: *Your MongoDB Atlas connection string*
   - `REDIS_URL`: *Your Upstash Redis connection string*
   - `JWT_SECRET`: *A secure random string (e.g., generate one with `openssl rand -hex 32`)*
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: *The URL of your frontend (e.g., `https://your-app.vercel.app` - you can update this later)*
   - *(Optional Google Login variables)*: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
6. Click **Create Web Service**. Render will build and deploy your backend. Copy the generated service URL (e.g., `https://echo-chamber-backend.onrender.com`).

---

## Step 4: Deploy the Frontend to Vercel (Free SPA)

1. Sign up/log in to [Vercel](https://vercel.com/).
2. Click **Add New** -> **Project**.
3. Select your GitHub repository.
4. Configure the build settings:
   - **Framework Preset:** `Vite` (Vercel auto-detects this)
   - **Root Directory:** `client`
5. In the **Environment Variables** section, add:
   - `VITE_BACKEND_URL`: *The URL of your Render backend copied in Step 3 (e.g., `https://echo-chamber-backend.onrender.com`)*
6. Click **Deploy**. Vercel will build your static assets and host the SPA.

Once Vercel completes the build, it will output a production URL (e.g., `https://echo-chamber.vercel.app`). 

Go back to **Render** and update the `FRONTEND_URL` environment variable to match this production URL. Save changes and Render will automatically restart.

---

## Step 5: (Optional) Google Console Redirect Update

If using Google OAuth, update the callback URI in your Google Developer console to point to:
```text
https://echo-chamber-backend.onrender.com/api/auth/google/callback
```
And update the authorized origin to:
```text
https://echo-chamber.vercel.app
```
