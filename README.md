# Devanagari Hindi Document OCR & Excel Extractor

This application is a full-stack, responsive, high-performance **Devanagari Hindi Document OCR & Interactive Excel Extractor** with an integrated per-page billing wallet. 

---

## 🇮🇳 आसान भाषा में निर्देश (Hindi Instructions)

यह ऐप आपके लिए पूरी तरह तैयार है! अगर आप इसे बिना किसी झंझट के **एक क्लिक में ऑनलाइन चालू** करना चाहते हैं, तो नीचे दिए गए "Deploy to Render" या Vercel स्टेप्स को देखें।

### 🌟 1-क्लिक में ऑनलाइन लाइव कैसे करें? (Deploy Online in 1-Click)
आप इसे **Render** या **Vercel** पर बिल्कुल मुफ्त में चला सकते हैं:

#### विकल्प A: **Render.com** पर चलाना (सबसे आसान - Node.js Backend के लिए)
1. **Render.com** पर जाएं और मुफ्त अकाउंट बनाएं।
2. **New +** -> **Web Service** पर क्लिक करें।
3. अपने GitHub रिपोजिटरी को कनेक्ट करें (या ZIP कोड अपलोड करें)।
4. सेटिंग्स में ये डालें:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
5. **Environment Variables** (पर्यावरण चर) में यह जोड़ें:
   - `GEMINI_API_KEY` = `आपकी असली API Key`
6. "Deploy" पर क्लिक करें। आपकी वेबसाइट ऑनलाइन हो जाएगी!

#### विकल्प B: **Vercel.com** पर चलाना
1. Vercel पर जाकर नया प्रोजेक्ट इम्पोर्ट करें।
2. **Build and Development Settings** को डिफॉल्ट रहने दें।
3. **Environment Variables** में `GEMINI_API_KEY` जोड़ें।
4. "Deploy" पर क्लिक करें। 1 मिनट में लिंक लाइव हो जाएगा!

#### विकल्प C: **Netlify.com** पर चलाना (Step-by-Step Instructions)
Netlify मुख्य रूप से Static Websites (frontend only) के लिए जाना जाता है। क्योंकि इस ऐप में सुरक्षित तरीके से Gemini API चलाने के लिए Node.js Backend है, Netlify पर इसे चलाने के लिए आप **Netlify Functions** का उपयोग कर सकते हैं या फिर इसे Full-Stack Serverless Setup दे सकते हैं:

1. **Netlify.com** पर मुफ्त अकाउंट बनाएं।
2. **Add new site** -> **Import from an existing project** (GitHub से कनेक्ट करें या ZIP ड्रैग-ड्रॉप करें)।
3. **Build settings** में निम्नलिखित सेटिंग्स भरें:
   - **Build Command**: `npm run build`
   - **Publish directory**: `dist`
4. **Site Configuration** -> **Environment Variables** में जाएँ।
5. **Add Variable** पर क्लिक करके निम्नलिखित डालें:
   - Key: `GEMINI_API_KEY`
   - Value: `आपकी असली Google Gemini API Key`
6. **Deploy** बटन पर क्लिक करें! 
7. *(विशेष नोट: यदि आप Netlify पर बिना किसी Backend सर्वर के चलाना चाहते हैं, तो Render.com या Railway.app सबसे अच्छे विकल्प हैं क्योंकि ये फुल-स्टैक Node/Express सर्वर को 100% सपोर्ट करते हैं और बिना अतिरिक्त कोड के चलते हैं।)*

---

## 🚀 How to Run Locally (कंप्यूटर पर कैसे चलाएं)

If you export or download this application as a ZIP, follow these simple steps to run it on your local machine:

### 1. Prerequisites (ज़रूरी चीजें)
Ensure you have **Node.js** (v18 or higher) and **npm** installed on your system.
You can download Node.js from [nodejs.org](https://nodejs.org/).

### 2. Install Dependencies (लाइब्रेरी इंस्टॉल करें)
Open your terminal in the project directory and run:
```bash
npm install
```

### 3. Configure the Environment Key (`.env`)
The server uses the secure backend proxy strategy to perform AI-based document scanning. You need an API Key to enable parsing.

1. Copy the `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file in your text editor.
3. Replace the placeholder value with your real API Key:
   ```env
   GEMINI_API_KEY="your_actual_api_key_here"
   ```

> **🔑 How to get an API Key:**
> You can get a free API key instantly by logging into **Google AI Studio** or Google Cloud, creating a key, and placing it in the `.env` file.

### 4. Run Development Server (ऐप को चालू करें)
To launch the application in development mode with live reload:
```bash
npm run dev
```
Once started, open your web browser and navigate to:
**`http://localhost:3000`**

### 5. Build for Production
To bundle client-side static assets and prepare the project for production deployment:
```bash
# Build the application
npm run build

# Start the production server
npm run start
```

---

## 🛠️ Main Tech Stack
- **Frontend**: React (v19), Vite, Tailwind CSS, Motion (AnimatePresence transitions), Lucide Icons.
- **Backend**: Node.js, Express, tsx, Google AI Processing SDK.
- **File System Limits**: Supports uploading PDFs and high-res document images up to **20 MB** per page.
- **Per-Page Billing Wallet**: Charges **1 Credit per page extracted** successfully (equivalent to ₹0.50). Includes secure Admin Recharge console (Default PIN: `Harsh4075`) to add credits instantly when customers pay you via UPI (`harshjeliya1-3@oksbi`).
