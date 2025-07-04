# 🛡️ encryption_medoc v1.1.0

🔒 **Encryption Package in JS**

📖 **Full Documentation:** [See docs/index.md](./docs/index.md)

---

To use it add it to package.json as

```json
{
    "dependencies":{
            "encryption_medoc": "github:MedocHealth/encryption_medoc#v1.0.0",
    }
}
```

then run the following command

```bash
npm install
```

⚠️ If for some reason NPM install fails then follow the instructions on `prepare.js` and execute those commands by yourself on the deploying machine. And in Developement mode create a fallback to your normal client using the `isUbuntu` function here.

---

## 🚀 Quick Start

In the root of your JS/TS application create instances of the following:

```javascript
const MONGO_URL = "<your database URL>"
const app = express();
const encDb = new EncryptedMongoClient(app);
encDb.init(MONGO_URL).then((val)=>{
    setClient(val);
}).catch((e)=>{
    console.error("Error connection DB", e );
    process.exit(1)
});
```

In your db connection functions you'd add:

```javascript
let mongoClient;

function setClient(client:MongoClient){
    mongoClient = client;
}

function connectMongoDb(){
    if(!mongoClient) throw Error("DB client is not created")
}
```

Then, to avoid circular dependency errors, create an `enc.ts` file in your source code and add the following:

```javascript
export const encService = new Encryption(MONGO_URL);
```

Wherever needed for encryption and decryption use it as follows:

```javascript
const keyData = encService.createKeyForUser(username);
const cipher = encService.encrypt(username, data)
```

The available functions and their signatures are defined in the `Function_Signatures.md`.

---

## 📚 Documentation

For detailed guides, module explanations, and advanced usage, see:

📃👉 [**Documentation Index**](./docs/index.md)

---
