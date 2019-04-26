'use strict';
const nconf = require('nconf');
const MongoClient = require('mongodb').MongoClient;
const inquirer = require('inquirer');
const {table} = require('table');

nconf.argv().env().file('./config.json');

// Mongodb connection setup
const uri = `mongodb+srv://${nconf.get('mongodb:username')}:${nconf.get('mongodb:password')}@${nconf.get("mongodb:hostlist")}/${nconf.get('mongodb:database')}?retryWrites=true`;
const client = new MongoClient(uri, { useNewUrlParser: true });
const client2 = new MongoClient(uri, { useNewUrlParser: true });

const shopManager = new Promise((resolve, reject) => {

    // Connect to client to collect valid product data for user input verification
    client.connect(async (err) => {
        if (err) reject(err);
        const collection = client.db(nconf.get("mongodb:database")).collection("products");
        // Gather data from the products collection
        const productData = await collection.find({}).toArray();
        resolve(productData);
        client.close();
    });
});

shopManager.then((productData) => {

    // Prompt user to choose a managerial shop task
    inquirer
        .prompt([{
            type: 'list',
            name: 'choice',
            message: 'What would you like to do?',
            choices: ['View products for sale', 'View low inventory', 'Update inventory', 'Add new product', 'Delete product']
        }])

        // Use the selection to perform one of a number of database operations
        .then((answers) => {
            switch (answers.choice) {
                // Display products for sale in a table
                case 'View products for sale':
                    
                    // Create a table of all product data
                    let dataTable = [['Item ID', 'Product Name', 'Department Name', 'Price ($)', 'Stock']];
                    for (let i = 0; i < productData.length; i++) {
                        dataTable.push([i, productData[i].product_name, productData[i].department_name, productData[i].price, productData[i].stock_quantity]);
                    }
                    console.log(table(dataTable));
                    break;

                // View only items sold by the shop that have less than 5 in stock
                case 'View low inventory':
                    // Connect to database
                    client2.connect(async (err) => {
                        if (err) throw err;
                        const collection = client2.db(nconf.get("mongodb:database")).collection("products");
                        
                        // Gather data about products with low inventory
                        const lowStock = await collection.find({stock_quantity: {$lt: 5}}).toArray();

                        // Create a table of the relevant data 
                        let dataTable = [['Item ID', 'Product Name', 'Department Name', 'Price ($)', 'Stock']];
                        for (let i = 0; i < lowStock.length; i++) {
                            let itemID = productData.map(i => `${i._id}`).indexOf(`${lowStock[i]._id}`);
                            dataTable.push([itemID, lowStock[i].product_name, lowStock[i].department_name, lowStock[i].price, lowStock[i].stock_quantity]);
                        }
                        console.log(table(dataTable));
                        client2.close();
                    });
                    break;

                // Set the stock of a product, prompt for the item ID and amount
                case 'Update inventory':
                    inquirer.prompt([{
                        type: 'number',
                        name: 'itemID',
                        message: 'Enter the item ID of the product:',
                        validate: (input) => {
                            if (input >= 0 && input < productData.length) return true;
                            return 'Please enter a valid item ID';
                        }
                    },{
                        type: 'number',
                        name: 'quantity',
                        message: 'Enter new item quantity',
                        validate: (input) => {
                            if (input >= 0) return true;
                            return 'Please enter a valid number of units';
                        }
                    }]).then((answers) => {
                        // Connect to database
                        client2.connect(async (err) => {
                            if (err) throw err;
                            const collection = client2.db(nconf.get("mongodb:database")).collection("products");
                            
                            // Update the inventory of the selected item
                            await collection.updateOne({_id: productData[answers.itemID]._id}, {$set: {stock_quantity: answers.quantity}});

                            client2.close(() => console.log('Database updated.'));
                        });
                    }).catch((error) => {
                        throw error;
                    });
                    break;

                // Add a new product to the shop's inventory
                case 'Add new product':
                    inquirer.prompt([{
                        type: 'input',
                        name: 'name',
                        message: 'Enter the name of the product:',
                        validate: (input) => {
                            if (input == '') return 'Please enter a name';
                            return true;
                        }
                    },{
                        type: 'input',
                        name: 'department',
                        message: 'Enter department name:'
                    },{
                        type: 'number',
                        name: 'price',
                        message: 'Enter price:',
                        validate: (input) => {
                            if (input >= 0) return true;
                            return 'Please enter a valid price';
                        }
                    },{
                        type: 'number',
                        name: 'stock',
                        message: 'Enter the number in stock:',
                        validate: (input) => {
                            if (input >= 0) return true;
                            return 'Please enter a valid number';
                        }
                    }]).then((answers) => {
                        // Connect to database
                        client2.connect(async (err) => {
                            if (err) throw err;
                            const collection = client2.db(nconf.get("mongodb:database")).collection("products");
                            
                            // Add the product to the database
                            await collection.insertOne({
                                product_name: answers.name,
                                department_name: answers.department,
                                price: answers.price,
                                stock_quantity: answers.stock
                            });

                            client2.close(() => console.log('Database updated.'));
                        });     
                    }).catch((error) => {
                        throw error;
                    });
                    break;

                // Delete a product from the shop's inventory
                case 'Delete product':
                    inquirer.prompt([{
                        type: 'number',
                        name: 'itemID',
                        message: 'Choose the item ID of a product to delete from inventory:',
                        validate: (input) => {
                            if (input >= 0 && input < productData.length) return true;
                            return 'Please enter a valid item ID';
                        }
                    }]).then((answers) => {
                        // Connect to database
                        client2.connect(async (err) => {
                            if (err) throw err;
                            const collection = client2.db(nconf.get("mongodb:database")).collection("products");
                            
                            // Delete the product from the database
                            await collection.deleteOne({
                                _id: productData[answers.itemID]._id
                            });

                            client2.close(() => console.log('Database updated.'));
                        }); 
                    }).catch((error) => {
                        throw error;
                    });
                    break;
            }
        })
        .catch((error) => {
            throw error;
        });
        
}).catch((error) => {
    throw error;
});