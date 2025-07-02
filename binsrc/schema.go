package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// const AZURE_TENANT_ID = "24b073b9-1bae-4f93-8e33-f91c076f7e61"
// const AZURE_CLIENT_ID = "024fc775-79ea-4091-88c5-5401a8000ea2"
// const AZURE_CLIENT_SECRET = "QsI8Q~2i7GVKqLdvusJBYIaWJ9ZUtz6QYlmsDbot"
// const AZURE_KEY_NAME = "medoc-key"
// const AZURE_KEY_VERSION = "feacb7e500ad466b98539f60ce490355"
// const AZURE_KEY_VAULT_ENDPOINT = "https://medoc-key-vault.vault.azure.net/"
// const KEYVALUT_DB = "MedocKeyVault"
// const KEYVALUT_COLLECTION = "__keyvault"
// const PROVIDER = "azure"

var KEY_VAULT_NAMESPACE string = KEYVALUT_DB + "." + KEYVALUT_COLLECTION

var KMS_PROVIDERS map[string]map[string]interface{} = map[string]map[string]interface{}{
	"azure": {
		"tenantId":     AZURE_TENANT_ID,
		"clientId":     AZURE_CLIENT_ID,
		"clientSecret": AZURE_CLIENT_SECRET,
	},
}
var MASTERKEY = map[string]interface{}{
	"keyVaultEndPoint": AZURE_KEY_VAULT_ENDPOINT,
	"keyName":          AZURE_KEY_NAME,
}

func main() {
	//args := os.Args
	dbUrl := "mongodb+srv://team_medoc:Atlas_Medoc@dbhospital.kfabsde.mongodb.net/?retryWrites=true&w=majority&appName=DBHospital"
	generateSchema(dbUrl)
}

func generateSchema(dbUrl string) {
	var path string = "../conf/schema.json"
	f, err := os.Open(path)
	if err != nil {
		os.Stderr.WriteString(err.Error())
	}
	defer f.Close()
	fs, err := os.ReadFile(path)
	//os.Stdout.WriteString(string(fs))
	if err != nil {
		os.Stderr.WriteString(err.Error())
	}
	var jsonArray []map[string]map[string]interface{}
	if err := json.Unmarshal(fs, &jsonArray); err != nil {
		os.Stderr.WriteString(err.Error())
	}
	json.Marshal(fs)
	os.Stdout.WriteString(dbUrl + "\n")
	url := dbUrl
	if url == "" {
		log.Fatal("Set your 'MONGODB_URI' environment variable. " +

			"usage-examples/#environment-variable")
	}

	client, err := mongo.Connect(options.Client().ApplyURI(url))
	if err != nil {
		panic(err)
	}
	defer func() {
		if err := client.Disconnect(context.TODO()); err != nil {
			panic(err)
		}
	}()

	createIndex(client)

	schemaMap := make(map[string]map[string]interface{})
	// var mu sync.Mutex
	// var wg sync.WaitGroup

	// ctx := context.Background()

	for i, collectionDef := range jsonArray {
		if i == 1 {
			//fmt.Println(collectionDef)
		}
		for _collName, fields := range collectionDef {
			val, err := getSchemaforCollection(_collName, fields, client)
			if err != nil {
				panic(err)
			}
			schemaMap[_collName] = val
			//fmt.Println(val)
		}

	}

	json, err := json.Marshal(schemaMap)
	if err != nil {
		os.Stderr.WriteString(err.Error())
	}
	os.Stdout.WriteString(string(json))
}

func getSchemaforCollection(collName string, fieldsDef map[string]interface{}, client *mongo.Client) (map[string]interface{}, error) {
	algo := "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic"

	properties := make(map[string]interface{})
	for _fieldName, _type := range fieldsDef {
		var fieldType string

		if _, ok := _type.([]interface{}); ok {
			fieldType = "array"
		} else if str, ok := _type.(string); ok {
			fieldType = strings.ToLower(str)
		} else {
			fieldType = "unknown"
		}
		altName := collName + "." + _fieldName
		dekId, err := encusreDekForField(client, altName)
		if err != nil {
			return nil, err
		}

		if fieldType == "array" {
			properties[_fieldName] = map[string]interface{}{
				"bson": "array",
				"items": map[string]interface{}{
					"bsonType": "string",
					"encrypt": map[string]interface{}{
						"bsonType":  "string",
						"algorithm": algo,
						"keyId":     dekId,
					},
				},
			}
		} else {
			properties[_fieldName] = map[string]interface{}{
				"bson": "string",
				"encrypt": map[string]interface{}{
					"bsonType":  "string",
					"algorithm": algo,
					"keyId":     dekId,
				},
			}

		}
	}
	return map[string]interface{}{
		"bsonType":   "object",
		"properties": properties,
	}, nil
}

func encusreDekForField(client *mongo.Client, altName string) (string, error) {
	clientOptions := options.ClientEncryption().
		SetKeyVaultNamespace(KEY_VAULT_NAMESPACE).
		SetKmsProviders(KMS_PROVIDERS)

	clientEnc, err := mongo.NewClientEncryption(client, clientOptions)
	if err != nil {
		os.Stderr.WriteString(err.Error())
	}
	defer func() {
		_ = clientEnc.Close(context.TODO())
	}()

	dataKeyOpts := options.DataKey().
		SetMasterKey(MASTERKEY).SetKeyAltNames([]string{altName})

	dataKeyID, err := clientEnc.CreateDataKey(context.TODO(), PROVIDER, dataKeyOpts)
	if err != nil {
		return "", err
	}
	return string(dataKeyID.Data), nil
}

func createIndex(client *mongo.Client) {
	keyValtDb := "MedocKeyVault"
	keyVaultColl := "__keyVault"
	//keyVaultNameSpace := keyValtDb + "." + keyVaultColl
	keyVaultIndex := mongo.IndexModel{
		Keys: bson.D{{Key: "keyAltNames", Value: 1}},
		Options: options.Index().
			SetUnique(true).
			SetPartialFilterExpression(bson.D{
				{Key: "keyMaterial", Value: bson.D{
					{Key: "$exists", Value: true}}}}),
	}
	_, err := client.Database(keyValtDb).Collection(keyVaultColl).Indexes().CreateOne(context.TODO(), keyVaultIndex)
	if err != nil {
		panic(err)
	}
}

type KMSProviders struct {
	Azure struct {
		TenantID                 string
		ClientID                 string
		ClientSecret             string
		IdentityPlatformEndpoint string
	}
}
