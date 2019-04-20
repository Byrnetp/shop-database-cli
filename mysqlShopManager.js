'use strict';
const nconf = require('nconf');
const mysql = require('mysql');
const inquirer = require('inquirer');
const {table} = require('table');

nconf.argv().env().file('./config.json');

// Set up mysql database connection settings
const connection = mysql.createConnection({
    host     : nconf.get('mysql:host'),
    user     : nconf.get('mysql:user'),
    password : nconf.get('mysql:password'),
    database : nconf.get('mysql:database')
});

const shopManager = new Promise((resolve, reject) => {

    // Connect to database to collect available item IDs
    connection.connect();
    connection.query('SELECT item_id FROM products;', (error, results, fields) => {
        if (error) throw error;
        const shopIDs = results.map((item) => item.item_id);
        resolve(shopIDs);
    });
});

shopManager.then((shopIDs) => {

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
                    connection.query('SELECT * FROM products;', (error, results, fields) => {
                        if (error) throw error;
                        let saleData = [['Item ID', 'Product Name', 'Department name', 'Price ($)', 'Stock quantity']];
                        for (let item of results) {
                            saleData.push([item.item_id, item.product_name, item.department_name, item.price, item.stock_quantity]);
                        }
                        console.log(table(saleData));
                    });
                    connection.end();
                    break;

                // View only items sold by the shop that have less than 5 in stock
                case 'View low inventory':
                    connection.query('SELECT * FROM products WHERE stock_quantity < 5;', (error, results, fields) => {
                        if (error) throw error;
                        let saleData = [['Item ID', 'Product Name', 'Department name', 'Price ($)', 'Stock quantity']];
                        for (let item of results) {
                            saleData.push([item.item_id, item.product_name, item.department_name, item.price, item.stock_quantity]);
                        }
                        console.log(table(saleData));
                    });
                    connection.end();
                    break;

                // Set the stock of a product, prompt for the item ID and amount
                case 'Update inventory':
                    inquirer.prompt([{
                        type: 'number',
                        name: 'itemID',
                        message: 'Enter the item ID of the product:',
                        validate: (input) => {
                            if (shopIDs.indexOf(input) != -1) return true;
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
                        connection.query(`UPDATE products SET stock_quantity = ${mysql.escape(answers.quantity)} WHERE item_id = ${mysql.escape(answers.itemID)};`, (error, results, fields) => {
                            if (error) throw error;
                            console.log(`Stock for item #${answers.itemID} updated.`);
                        });
                        connection.end();
                    }).catch((error) => {
                        connection.end();
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
                        connection.query(`INSERT INTO products (product_name, department_name, price, stock_quantity) VALUES (${mysql.escape(answers.name)}, ${mysql.escape(answers.department)}, ${mysql.escape(answers.price)}, ${mysql.escape(answers.stock)});`, (error, results, fields) => {
                            if (error) throw error;
                            console.log(`Products table updated.`);
                        });
                        connection.end();
                    }).catch((error) => {
                        connection.end();
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
                            if (shopIDs.indexOf(input) != -1) return true;
                            return 'Please enter a valid item ID';
                        }
                    }]).then((answers) => {
                        connection.query(`DELETE FROM products WHERE item_id= ${mysql.escape(answers.itemID)};`, (error, results, fields) => {
                            if (error) throw error;
                            console.log('Products table updated.');
                        });
                        connection.end();
                    }).catch((error) => {
                        connection.end();
                        throw error;
                    });
                    break;
            }
        })
        .catch((error) => {
            connection.end();
            throw error;
        });
        
}).catch((error) => {
    connection.end();
    throw error;
});