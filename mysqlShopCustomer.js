'use strict';
const nconf = require('nconf');
const mysql = require('mysql');
const inquirer = require('inquirer');
const {table} = require('table');

nconf.argv().env().file('./config.json');

// initialize variable to store product data retrieved from the database
let productData;

// Set up mysql database connection settings
const connection = mysql.createConnection({
    host     : nconf.get('mysql:host'),
    user     : nconf.get('mysql:user'),
    password : nconf.get('mysql:password'),
    database : nconf.get('mysql:database')
});

// Wrapping the initial database query in a promise to ensure that the later update query is executed afterward
const shopFront = new Promise((resolve, reject) => {

    connection.connect();

    // Collect data from the server and display a table of products for the user to choose from
    connection.query('SELECT * FROM products;', (error, results, fields) => {
        if (error) throw error;
        productData = results;
        let saleData = [['Item ID', 'Product Name', 'Price ($)']];
        for (let item of results) {
            saleData.push([item.item_id, item.product_name, item.price]);
        }
        console.log(table(saleData));

        // Prompt the user to choose an item to purchase using the item ID and select a quantity once the data has been gathered
        inquirer
            // First prompt for the item ID of the desired item
            .prompt([{
                type: 'number',
                name: 'itemID',
                message: 'Enter the item ID of the product you would like to purchase:',
                validate: (input) => {
                    if (input > 0 && input <= productData.length) {
                        return true;
                    }
                    return 'Please select a valid item ID to purchase';
                }
            },
            // Next prompt for the quantity to purchase
            {
                type: 'number',
                name: 'quantity',
                message: 'How many would you like to purchase?',
                validate: (input) => {
                    if (input >= 0) {
                        return true;
                    }
                    return 'Plese enter a valid quantity to purchase'
                },
                default: 0
            }])
            // After answers are collected, if there isn't enough in stock cancel the purchase. Otherwise, display price and update purhcase completion status
            .then((answers) => {
                if (answers.quantity > productData[answers.itemID - 1].stock_quantity) {
                    console.log('Insufficient quantity in stock, Sorry!')
                } else {
                    console.log(`Price of purchase: $${productData[answers.itemID - 1].price * answers.quantity}`);
                }
                resolve(answers);
            }).catch((error) => {
                reject(error);
            });
    });

});

// If the purchase was successfully completed, update the database to reflect the new quantity of the purchased item.
shopFront.then((answers) => {
    connection.query(`UPDATE products SET stock_quantity = ${mysql.escape(productData[answers.itemID - 1].stock_quantity - answers.quantity)} WHERE item_id = ${mysql.escape(answers.itemID)};`, (error, results, fields) => {
        if (error) throw error;
        console.log('Updating database...');
    })
    connection.end();
});

shopFront.catch((error) => {
    connection.end();
    throw error;
});