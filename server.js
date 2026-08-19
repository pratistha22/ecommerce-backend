require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

  // Customer schema
const customerSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: String,
});
const Customer = mongoose.model("Customer", customerSchema);
// Order schema
const orderSchema = new mongoose.Schema({
  name: String,
  address: String,
  phone: String,
  items: Array,
  total: Number,
  date: String,
  status: { type: String, default: "Pending" },
  customerEmail: String,
});
const Order = mongoose.model("Order", orderSchema);

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Customer signup
app.post("/api/customers/signup", async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    const existing = await Customer.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = new Customer({ name, email, password: hashedPassword, phone, address });
    await customer.save();

    const token = jwt.sign({ id: customer._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, customer: { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } });
  } catch (err) {
    res.status(500).json({ message: "Signup failed" });
  }
});

// Customer login
app.post("/api/customers/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: customer._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, customer: { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});
// Owner login route
app.post("/api/login", (req, res) => {
  const { password } = req.body;

  if (password === process.env.OWNER_PASSWORD) {
    const token = jwt.sign({ role: "owner" }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password" });
  }
});

// Create a new order (called at checkout)
// Prepare eSewa payment data
app.post("/api/esewa/initiate", (req, res) => {
  const { amount, transactionId } = req.body;

  const totalAmount = String(amount);
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionId},product_code=EPAYTEST`;

  const secretKey = "8gBm/:&EnhH.1/q";
  const hash = crypto.createHmac("sha256", secretKey).update(message).digest("base64");

    res.json({
    amount: totalAmount,
    tax_amount: "0",
    total_amount: totalAmount,
    transaction_uuid: transactionId,
    product_code: "EPAYTEST",
    product_service_charge: 0,
    product_delivery_charge: 0,
    success_url: "http://localhost:5173/payment-success",
    failure_url: "http://localhost:5173/payment-failure",
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature: hash,
  });
});
app.post("/api/orders", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: "Failed to save order" });
  }
});

// Get orders for a specific customer
app.get("/api/orders/customer/:email", async (req, res) => {
  try {
    const orders = await Order.find({ customerEmail: req.params.email }).sort({ _id: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch customer orders" });
  }
});
// Get all orders (owner only, protected)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ _id: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// Update order status
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Failed to update order" });
  }
});

// Delete an order
app.delete("/api/orders/:id", async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete order" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));