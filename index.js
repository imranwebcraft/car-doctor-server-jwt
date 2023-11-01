const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
	cors({
		origin: ["http://localhost:5173"],
		credentials: true,
	})
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7o1h45b.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

// My middleware

const logger = (req, res, next) => {
	console.log("logInfo:", req.method, req.url);
	next();
};

const verifyToken = async (req, res, next) => {
	//DONE: Get user token
	const token = req?.cookies?.token;
	//DONE: If user don't have any token, don't go forward
	if (!token) {
		return res.status(401).send({ message: "unAuthoroze Access1" });
	}
	//DONE: If user have token then verify the token
	jwt.verify(token, process.env.ACCESS_TOKE_SECRET, (err, decoded) => {
		// IF error
		if (err) {
			return res.status(401).send({ message: "auAuthorize Acccess2" });
		}
		req.user = decoded;
		next();
	});
};

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();

		const serviceCollection = client.db("carDoctor").collection("services");
		const bookingCollection = client.db("carDoctor").collection("bookings");

		// Auth related API
		app.post("/jwt", async (req, res) => {
			// Get user info
			const userInfo = req.body;
			console.log(userInfo);
			// Create token for the user
			const token = jwt.sign(userInfo, process.env.ACCESS_TOKE_SECRET, {
				expiresIn: "1h",
			});
			// Send token to the client side
			res
				.cookie("token", token, {
					httpOnly: true,
					secure: true,
				})
				.send({ success: true });
		});

		app.post("/logout", async (req, res) => {
			// Get logout user info
			const user = req.body;
			// Clear cookie
			res
				.clearCookie("token", {
					maxAge: 0,
				})
				.send({ success: true });
		});

		//service related API
		app.get("/services", async (req, res) => {
			const cursor = serviceCollection.find();
			const result = await cursor.toArray();
			res.send(result);
		});

		app.get("/services/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };

			const options = {
				// Include only the `title` and `imdb` fields in the returned document
				projection: { title: 1, price: 1, service_id: 1, img: 1 },
			};

			const result = await serviceCollection.findOne(query, options);
			res.send(result);
		});

		// bookings
		app.get("/bookings", logger, verifyToken, async (req, res) => {
			console.log("token owner info", req.user);
			// Cross check the user
			if (req.user.email !== req.query?.email) {
				return res.status(403).send({ message: "Access Forbiden" });
			}
			// console.log(req.query.email);
			let query = {};
			if (req.query?.email) {
				query = { email: req.query.email };
			}
			const result = await bookingCollection.find(query).toArray();
			res.send(result);
		});

		app.post("/bookings", async (req, res) => {
			const booking = req.body;
			console.log(booking);
			const result = await bookingCollection.insertOne(booking);
			res.send(result);
		});

		app.patch("/bookings/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const updatedBooking = req.body;
			console.log(updatedBooking);
			const updateDoc = {
				$set: {
					status: updatedBooking.status,
				},
			};
			const result = await bookingCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		app.delete("/bookings/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await bookingCollection.deleteOne(query);
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("doctor is running");
});

app.listen(port, () => {
	console.log(`Car Doctor Server is running on port ${port}`);
});
