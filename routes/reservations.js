const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation"); // Adjust the path to your reservations.js model

// Middleware to ensure the user is authenticated (adjust based on your auth setup)
const isAuthenticated = (req, res, next) => {
    if (req.session.user) { // Example using sessions; adjust for JWT if needed
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
};

// GET endpoint to fetch reservations for the logged-in user
router.get("/user-reservations", isAuthenticated, async (req, res) => {
    try {
        const username = req.session.user.username; // Adjust based on your auth setup
        const reservations = await Reservation.find({ username })
            .populate("destination_id", "name") // Populate destination name
            .lean(); // Convert to plain JavaScript object
        res.json(reservations);
    } catch (error) {
        console.error("Error fetching reservations:", error);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;