# Intro Creg - Advanced Introduction System

<img width="1980" height="1080" alt="FULL SOURCE CODE_" src="https://github.com/user-attachments/assets/6e34ef06-384e-42da-9b8b-a8e10a343141" />

**Intro Creg** is the ultimate solution for Discord communities that require user introductions and verification. With a sleek, wizard-based setup and automated role management, it transforms how new members join your server.

## ✨ Key Features

### 📝 Automated Introduction Flow
- **Seamless Wizard**: Users click a single button to start their introduction.
- **Interactive Forms**: Clean modals for capturing Name, Age, Profession, Platform, and Bio.
- **Gender Selection**: Integrated gender selection step with role syncing.
- **Profile Cards**: Automatically generates beautiful, image-based profile summaries.

### 🛡️ Moderation & Verification
- **Approval System**: Staff review submissions before they go live.
- **One-Click Actions**: Approve, Reject, or Edit submissions directly from the admin log.
- **Auto-Roles**: Automatically assigns "Approved", "Male/Female/Guest" roles upon acceptance.
- **Intro Logging**: Detailed admin logs for every action.

### ⚡ Easy Administration
- **Setup Wizard**: Run `/setup` to automatically create all necessary channels, categories, and roles in seconds.
- **Customization**: Configure welcome messages, prompt titles, and embed colors.
- **Management Commands**: Edit or reset user profiles with simple commands like `/admin reset`.

---

## 🚀 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.9.0 or newer)
- [MySQL Database](https://www.mysql.com/) (or MariaDB)
- A [Discord Bot Token](https://discord.com/developers/applications)

### Step 1: Install
1. Download and extract the source code.
2. Open a terminal in the project folder.
3. Install dependencies:
   ```bash
   npm install
   ```

### Step 2: Configure
1. Rename `.env.example` to `.env`.
2. Open `.env` and fill in your details:
   ```env
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_db_pass
   DB_NAME=intro_creg_db
   ```
   *(The bot will automatically create the database tables on first launch.)*

### Step 3: Run
Start the bot:
```bash
npm start
```

---

## 🎮 Usage Guide

### 1. Initial Setup
Run the setup wizard to prepare your server:
```
/setup
```
This will:
- Create the "Intro Creg" category.
- Create log channels (`intro-approvals`, `mod-logs`).
- Create user channels (`introduce-yourself`, `fill-introductions`).
- Create/Find roles (`Approved`, `Male`, `Female`, `Guest`).
- Post the "Introduce Yourself" prompt.

### 2. User Flow
1. New user sees the "Introduction" embed.
2. User clicks **"Introduce Yourself"**.
3. User fills out the form and selects gender.
4. Moderators receive a request in `#intro-approvals`.
5. Upon approval, the user gets roles and their profile is posted to `#introductions`.

---

## 📜 Commands List

| Command | Description | Permission |
| :--- | :--- | :--- |
| `/setup` | Run the auto-setup wizard. | **Admin** |
| `/admin reset <user>` | Reset a user's intro status. | **Admin** |
| `/admin edit <user>` | Edit an approved intro. | **Admin** |
| `/profile [user]` | View a user's profile card. | Everyone |
| `/stats` | View introduction statistics. | Everyone |

---

## 📞 Support

If you need help installing or configuring the bot, please check out my work on [GitHub](https://github.com/VRAJX0000).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

