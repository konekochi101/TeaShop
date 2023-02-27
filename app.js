// Import necessary modules and setup the app and database
const { request } = require('express')
const setup = require('./setup.js')
const app = setup.app
const db = setup.db
const bcrypt = require('bcrypt');

// Set up a session middleware to handle session variables
const session=require('express-session')
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Handler for login form submissions
app.post('/login', (request,response) => {
    // Extract the username and password from the request body
    const myUsername = request.body.myUsername
    const myPassword = request.body.myPassword

    // Retrieve the user from the database using the username
    const sql = db.prepare('SELECT * FROM ussers WHERE username = (?)')
    const result = sql.get(myUsername)

    // Extract the user's information from the database result
    const username = result.username;
    const password = result.password;
    const isAdmin = result.isAdmin
    const id = result.id

    // Check if the provided credentials match the user's credentials in the database
    if (
        myUsername == username && 
        bcrypt.compareSync(request.body.myPassword, password) == true
        ) 
    {
        // If the user is an admin, set the session variable isAdmin to true
        if(isAdmin == 1){ request.session.isAdmin = true} 
        else{ request.session.isAdmin = false}

        // Set the session variables logedIn, myUsername, and myId
        request.session.logedIn = true;
        request.session.myUsername = username;
        request.session.myId = id

        // Redirect to the home page
        response.redirect('/');
    } else {
        // If the provided credentials do not match a user's credentials, set the session variable logedIn to false and redirect back to the login page
        request.session.logedIn = false;
        response.redirect('/loginForm.html');
    }
})

// Handler for signup form submissions
app.post('/signup', (request, response) => {
    // Extract the username and password from the request body
    const username = request.body.username;
    const password = request.body.password;

    // Hash and salt the password using bcrypt
    const hashedPPassword = bcrypt.hashSync(password, 10)

    // Insert the user into the database
    const sql = db.prepare('INSERT INTO ussers (username, password) VALUES (?,?)')
    sql.run(username,hashedPPassword)

    // Set the session variable logedIn to true and redirect to the login page
    request.session.logedIn = true;
    response.redirect('/loginForm.html');
})

// Handler for the home page
app.get('', (request,response) => {
    // If the user is not logged in, redirect to the login page
    if(request.session.logedIn === false || request.session.logedIn === undefined){
        response.redirect("/loginForm.html")  
        return
    }

    // Retrieve all teas from the database and render the home page with the teas
    const sqlteas = db.prepare('SELECT * FROM teas')
    const teas = sqlteas.all()

    response.render("index.hbs", {
        title: "Welcome to milks tea house!", 
        teas: teas,
    })
})


/*This block of code retrieves a tea from a database using its ID and adds it to a shopping cart. 
If the shopping cart is empty, an empty array is created. If the tea already exists in the shopping cart, 
its quantity is increased. Otherwise, the tea is added to the shopping cart with a default quantity of 1. 
Finally, the user is redirected to the homepage. */

// Handler for adding a tea to the shopping cart
app.get('/addToOrder', (request, response) => {
    // Extract the tea ID from the query parameter
    const id = request.query.id;

    // Retrieve the tea from the database using the ID
    const sql = db.prepare("SELECT * FROM teas WHERE id = ?");
    const tea = sql.get(id);

    if (request.session.shoppingCart === undefined) {
        request.session.shoppingCart = [];
    }

    // finds the index of the item with the same ID in the shopping cart array. 
    // If it exists, it increases the quantity of the item. Otherwise, it adds a new item with a default quantity of 1.
    let found = false;
    for (const item of request.session.shoppingCart) {
        if (item.id == id) {
        item.quantity += 1;
        found = true;
        break;
        }
    } 

    if (!found) {
        request.session.shoppingCart.push({
        id: tea.id,
        tea: tea.tea,
        image: tea.image,
        description: tea.description,
        price: tea.price,
        quantity: 1
        });
    }

response.redirect("/");
})



/* This code handles GET requests to the '/shoppingCart' route. 
It checks if the request includes a query parameter named 'deleteItem' and removes the 
corresponding item from the shopping cart if it exists. Then, it renders a template named 
"shoppingCart.hbs" and passes the shopping cart as a variable named 'teas'.*/

// Handle GET requests to the '/shoppingCart' route
app.get('/shoppingCart', (request, response) => {

    // Create a new order in the 'orders' table, and store the resulting row ID in a variable called 'info'
   
    const deleteItem = request.query.deleteItem
    if(deleteItem != undefined){
    request.session.shoppingCart = request.session.shoppingCart.filter(item => item.id != deleteItem)
    }

    response.render("shoppingCart.hbs", {
        teas: request.session.shoppingCart,

    })
});



/* This code handles POST requests to the '/buyTea' route. 
It creates a new order in the 'orders' table with the user's ID and stores the
resulting row ID in a variable called 'info'. It then adds each item in the shopping 
cart to the 'orders_has_teas' table, associating them with the new order using the 'orders_id' column. 
After that, the shopping cart is cleared and the user is redirected to the homepage.*/

app.post('/buyTea', (request, response) => {
    const shoppingCart = request.session.shoppingCart
    const sql = db.prepare("INSERT INTO orders(ussers_id) VALUES (?)");
    const info = sql.run(request.session.ussers_id);

    for (const item of shoppingCart){
        const sql2 = db.prepare("INSERT INTO orders_has_teas(orders_id, teas_id, quantity) VALUES (? , ?, ?)")
        sql2.run(info.lastInsertRowid, item.id, item.quantity)
    }

    request.session.shoppingCart = []
    response.redirect("/")
});



app.get('/review', (request, response) => {
// get the currently logged-in user's username
//retrieves the myUsername value from the request.session object.
const myUsername = request.session.myUsername;

// get all reviews and associated tea information from the database using an inner join query.
const sql = db.prepare('SELECT reviews.id, review, tea_id, tea FROM reviews INNER JOIN teas ON reviews.tea_id = teas.id')
const rows = sql.all()

// gets all teas from the database.
const sql1 = db.prepare('SELECT * FROM teas')
const rows1 = sql1.all()

/*This block of code checks if the deleteItem query parameter is defined, 
and if so, deletes the corresponding review from the database and the user's session. 
If the deleteTeaId query parameter is defined, it also deletes the corresponding tea 
record from the database. */
const deleteItem = request.query.deleteItem
if (deleteItem != undefined) {
    const sql2 = db.prepare('DELETE FROM reviews WHERE id = ?')
    sql2.run(deleteItem)

    // Update the session review array to reflect the deleted review
    request.session.review = request.session.review?.filter(item => item.id != deleteItem)

    // Delete the tea record only after deleting the associated reviews
    const sql3 = db.prepare('DELETE FROM teas WHERE id = ?')
    sql3.run(request.query.deleteTeaId)
}

// creates a new array of review objects that includes the myUsername value for each review.
// add myUsername to each review object in the rows array (using the map function)
const content = rows.map(review => {
    return {
    id: review.id,
    tea_id: review.tea_id,
    tea: review.tea,
    review: review.review,
    myUsername: myUsername
    }
})

response.render("review.hbs", {
    title: "Review Room",
    content: content,
    content1: rows1,
    review: request.session.review,
    myUsername: myUsername
})
})


/*here i create a handler for the /review/editForm endpoint, which renders the reviewEdit.hbs 
template with a form for editing a review. If the id query parameter is missing or 
the review with that ID is not found in the database, an error message is sent with 
an appropriate status code */
app.get('/review/editForm', (request,response) => {
    const id = request.query.id
    if(!id) {
        response.status(400); //Set status off repsonse to 400 - Bad Request
        response.send('Missing query parameter id!');
        return
    } 
    
    const sql = db.prepare("SELECT * FROM reviews WHERE id=(?)")
    const review = sql.get(id)

    if(!review) {
        response.status(404); //Set status off repsonse to 404 - Not Found
        response.send('The id given was not found');
    }

    response.render("reviewEdit.hbs", {
        review: review
    })
})



//handler for input html-skjema
app.post("/reviewEdit", (request, response)=> {
    const id = request.body.id
    const review = request.body.review

    const sql = db.prepare("UPDATE reviews SET review=(?) WHERE id=(?)")
    const info = sql.run(review, id)

    if (info.changes === 1) {
        response.redirect("/review"); // redirect to the review page after successful update
    } else {
        response.status(400); //Set status off repsonse to 400 - Bad Request
        response.send('Update failed!');
    }
})



//handler for input html-skjema
app.post("/sendReview", (request, response)=> {
    
    const review = request.body.review
    const tea = request.body.tea
    const sql = db.prepare('INSERT INTO reviews (review, tea_id) VALUES (?, ?)')
    const info = sql.run(review, tea)

    response.redirect("/review");

})




//Starter opp applikasjonen
app.listen(3000, function() { 
    console.log("Server is up! Check http://localhost:3000")
})