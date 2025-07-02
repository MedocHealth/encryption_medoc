# FUNCTION AND CLASS SIGNATURES

This class contains the function signatures of the available functions of the EncryptedMongoClient.
It initializes the MongoClient object with the CSFLE (Client Side Field Level Encryption)
instructions and schema.

This is just a replacement or technically a wrapper to your existing MongoClient and done according to the README.md
then it works flawlessly with existing workflow and you can perform CRUD operations as usual.

This wrapper Client takes the data in JSON object form and return a JSON object on fetch queries to the DB.

For example :

```javascript
/**
 * The mongoClient here is defined the same way as defined in the README.md
 * 
 * **/
await mongoClient.connect();
const collection = await getCollection(MedocCollections.USERS,null);

const user = {
    name:"John Doe",
    username:"john@123"
    age:20,
    role:"admin",
    scopeLevel:5,
}

await collection.insertOne(user);

const u = await collection.findOne({username:"john@123"})

```

```javascript
class EncryptedMongoClient {

constructor(app:Application) 
/** Express application instance before sending in to the app.listen or server.listen 
 * 
**/


init(db_url): MongoClient;

}
```

another class

>[!NOTE]
> For the encryption serive below we are using Symmetric Encryption for which IV is generated each time for the procedure.
>
> The KEY size is 256 bit (32 bytes)
> The IV size is 128 bit (16 bytes)
> The Algorithm used is `aes-256-cbc`
>

The following class should not be used to insert or perform any CRUD operations to the DB.
For this class is to be only used only for transmission, i.e., when the data is transmitted between frontend and backend

```javascript

class EncryptionService {

    constructor(client:MongoClient): EncryptionService
    

    public async createKeyForUser(username: string): Promise<string> 
    /**
     * 
     * @param {string} username - the username of the user be it doctor, patient, nurse, paramedic
     *  it returns the key and keyId in the format
     * 
     * `${keyId}:${keyBase64}` 
     * 
     * */

    public async encrypt(username: string, data: string): Promise<string> 

    /**
     * This function takes 
     * @param {string} username - the username of the user be it doctor, patient, nurse, paramedic
     * @param {string} data - this is the Stringify JSON data
     * 
     * @returns {string} cipher - this is the ciphered string which is formatted as follows 
     * 
     * `${ivBase64}:${encryptedBase64}`
     * 
     * 
     * */

    public async decrypt(username: string, encryptedData: string, ivBase64: string): Promise<string> 
    /**
     * This function decrypts whatever is encrypted by the above function or it's equivalent
     * 
     * @param {string} username - the username of the user be it doctor, patient, nurse, paramedic
     * 
     * @param {string} encryptedData - the encrypted data is sent through in Base64 format
     * 
     * @param {string} ivBase64 - the IV given with the cipher 
     * 
     * */
    
    public async getKeyFromCollection(username: string): Promise<String> 

    /**
     * This fuction is used to directly fetch the Key assosiated with the username from the KMS and is not recommended to be used 
     * 
     * @param {string} username - the username of the user be it doctor, patient, nurse, paramedic
     * 
     * 
     * @returns {string} - This function returns the Key encoded in Base64 format string.
    **/



}

```
