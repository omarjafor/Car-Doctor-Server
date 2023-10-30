const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.21hcnfr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

//Custom Middlewares
const logger = async(req, res, next) => {
    // console.log('Called:', req.host, req.originalUrl);
    next();
}

const verifyToken = async(req, res, next) => {
    const token = req?.cookies?.token;
    // console.log('Value of token in middleware', token);
    if(!token){
        return res.status(401).send({ message: 'not authorized'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
            // console.log(err);
            return res.status(401).send( {message: 'unauthorized'} )
        }
        req.user = decoded;
        next()
    })
}
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const serviceCollection = client.db('carDoctor').collection('services');
        const bookingsCollection = client.db('carDoctor').collection('bookings');

        // Auth Related Api 
        app.post('/jwt', async(req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res
            .cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
            .send({ success: true }); 
        })

        app.post('/logout', async(req, res) => {
            const user = req.body;
            res.clearCookie('token', {maxAge: 0}).send({success: true})
        })

        // Services related api 
        app.get('/services', logger, async(req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/services/:id', async(req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await serviceCollection.findOne(query);
            res.send(result);
        })

        //Booking Related Api
        app.get('/bookings', logger, verifyToken, async(req, res) => {
            // console.log('TokTok Token', req.cookies.token);
            if(req.query.email !== req.user.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            let query = {};
            if(req.query?.email){
                query = { email: req.query.email }
            }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/bookings', async(req, res) => {
            const booking =req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

        app.patch('/bookings/:id', async(req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatebooking = req.body;
            const updateDoc = {
                $set: {
                    status: updatebooking.status
                }
            };
            const result = await bookingsCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/bookings/:id', async(req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Doctor Server is running');
})

app.listen(port, () => {
    console.log('Car Doctor Server is Running on Port', port);
})