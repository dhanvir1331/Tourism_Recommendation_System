jest.mock('../config/db', () => jest.fn());
jest.mock('ejs', () => ({
    render: jest.fn((template, data) => 'Mocked HTML'),
  }));
// Mock ensureAuthenticated middleware
jest.mock('../middleware/auth', () => ({
    ensureAuthenticated: jest.fn((req, res, next) => {
      if (req.user) next();
      else res.status(401).send('Unauthorized');
    }),
  }));
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const router = require('../routes/booking');
const Booking = require('../models/Booking');
const Destination = require('../models/Destination');
const { ensureAuthenticated } = require('../middleware/auth');

// Mock connectDB to prevent real MongoDB connection


// Create an Express app for testing
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', router);

// Mock EJS rendering
app.set('view engine', 'ejs');




describe('Booking Routes', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'test' });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    const user = { username: 'testuser' };
    jest.clearAllMocks();

    // Mock req.user for authenticated requests
    app.use((req, res, next) => {
      req.user = user;
      next();
    });

    // Clear database collections
    await Booking.deleteMany({});
    await Destination.deleteMany({});
  });

  // Test GET /booking
  describe('GET /booking', () => {
    it('should render booking page with destination', async () => {
      const destination = new Destination({
        name: 'Paris',
        description: 'City of Lights',
        location: { country: 'France', city: 'Paris', coordinates: { type: 'Point', coordinates: [2.35, 48.85] } },
        isIndian: false,
        image: 'paris.jpg',
        category: ['city', 'cultural'],
        budget: 'moderate',
        amount: 100,
        bestSeasons: ['spring'],
      });
      await destination.save();

      const response = await request(app).get('/booking?destination_name=Paris');
      expect(response.status).toBe(200);
      expect(require('ejs').render).toHaveBeenCalledWith(
        'booking',
        expect.objectContaining({ destination: expect.objectContaining({ name: 'Paris' }) })
      );
    });

    it('should return 400 if no destination specified', async () => {
      const response = await request(app).get('/booking');
      expect(response.status).toBe(400);
      expect(response.text).toBe('No destination specified');
    });

    it('should return 404 if destination not found', async () => {
      const response = await request(app).get('/booking?destination_name=Unknown');
      expect(response.status).toBe(404);
      expect(response.text).toBe('Destination not found');
    });

    it('should return 500 on server error', async () => {
      jest.spyOn(Destination, 'findOne').mockRejectedValue(new Error('DB Error'));
      const response = await request(app).get('/booking?destination_name=Paris');
      expect(response.status).toBe(500);
      expect(response.text).toBe('Server error');
    });

    it('should return 401 if not authenticated', async () => {
      app.use((req, res, next) => {
        req.user = null;
        next();
      });
      const response = await request(app).get('/booking?destination_name=Paris');
      expect(response.status).toBe(401);
      expect(response.text).toBe('Unauthorized');
    });
  });

  // Test POST /submit-booking
  describe('POST /submit-booking', () => {
    it('should create a booking successfully', async () => {
      const destination = new Destination({
        name: 'Paris',
        description: 'City of Lights',
        location: { country: 'France', city: 'Paris', coordinates: { type: 'Point', coordinates: [2.35, 48.85] } },
        isIndian: false,
        image: 'paris.jpg',
        category: ['city', 'cultural'],
        budget: 'moderate',
        amount: 100,
        bestSeasons: ['spring'],
      });
      await destination.save();

      const bookingData = {
        destination_name: 'Paris',
        visit_date: '2025-05-01',
        amount_paid: '250',
        hotel_price: '100',
        flight_price: '150',
      };

      const response = await request(app)
        .post('/submit-booking')
        .send(bookingData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        message: 'Booking confirmed!',
        redirect: expect.stringMatching(/\/payment\?booking_id=[a-f0-9]{24}/),
      });

      const booking = await Booking.findOne({ username: 'testuser' });
      expect(booking).toBeDefined();
      expect(booking.destination_id.toString()).toBe(destination._id.toString());
      expect(booking.visit_date.toISOString().split('T')[0]).toBe('2025-05-01');
      expect(booking.amount_paid).toBe(250);
      expect(booking.hotel_price).toBe(100);
      expect(booking.flight_price).toBe(150);
      expect(booking.payment_status).toBe('Pending');
    });

    it('should return 401 if not authenticated', async () => {
      app.use((req, res, next) => {
        req.user = null;
        next();
      });
      const response = await request(app)
        .post('/submit-booking')
        .send({ destination_name: 'Paris', visit_date: '2025-05-01', amount_paid: '100' });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ success: false, message: 'User not authenticated' });
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/submit-booking')
        .send({ destination_name: 'Paris' });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, message: 'Missing required fields' });
    });

    it('should return 400 if destination not found', async () => {
      const response = await request(app)
        .post('/submit-booking')
        .send({ destination_name: 'Unknown', visit_date: '2025-05-01', amount_paid: '100' });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, message: 'Destination not found' });
    });

    it('should return 400 if amount_paid does not match expected total', async () => {
      const destination = new Destination({
        name: 'Paris',
        description: 'City of Lights',
        location: { country: 'France', city: 'Paris', coordinates: { type: 'Point', coordinates: [2.35, 48.85] } },
        isIndian: false,
        image: 'paris.jpg',
        category: ['city', 'cultural'],
        budget: 'moderate',
        amount: 100,
        bestSeasons: ['spring'],
      });
      await destination.save();

      const response = await request(app)
        .post('/submit-booking')
        .send({
          destination_name: 'Paris',
          visit_date: '2025-05-01',
          amount_paid: '200', // Incorrect total (should be 250)
          hotel_price: '100',
          flight_price: '150',
        });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Incorrect total amount. Expected: 250, Received: 200',
      });
    });

    it('should return 500 on server error', async () => {
      jest.spyOn(Booking.prototype, 'save').mockRejectedValue(new Error('Save Error'));
      const destination = new Destination({
        name: 'Paris',
        description: 'City of Lights',
        location: { country: 'France', city: 'Paris', coordinates: { type: 'Point', coordinates: [2.35, 48.85] } },
        isIndian: false,
        image: 'paris.jpg',
        category: ['city', 'cultural'],
        budget: 'moderate',
        amount: 100,
        bestSeasons: ['spring'],
      });
      await destination.save();

      const response = await request(app)
        .post('/submit-booking')
        .send({
          destination_name: 'Paris',
          visit_date: '2025-05-01',
          amount_paid: '250',
          hotel_price: '100',
          flight_price: '150',
        });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: expect.stringContaining('Error processing booking: Save Error'),
      });
    });
  });

  // Test POST /api/hotels-free
  describe('POST /api/hotels-free', () => {
    it('should return mock hotel data', async () => {
      const response = await request(app)
        .post('/api/hotels-free')
        .send({ city: 'Paris' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [[{ hotelName: 'Hotel in Paris', hotelId: '123' }, [{ price1: 100 }]]],
      });
    });

    it('should return 400 if city is missing', async () => {
      const response = await request(app)
        .post('/api/hotels-free')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'City is required' });
    });

    it('should return 401 if not authenticated', async () => {
      app.use((req, res, next) => {
        req.user = null;
        next();
      });
      const response = await request(app)
        .post('/api/hotels-free')
        .send({ city: 'Paris' });
      expect(response.status).toBe(401);
      expect(response.text).toBe('Unauthorized');
    });
  });

  // Test POST /api/flights-free
  describe('POST /api/flights-free', () => {
    it('should return mock flight data', async () => {
      const response = await request(app)
        .post('/api/flights-free')
        .send({ origin: 'JFK', destination: 'LAX', date: '2025-05-01' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [{
          flightInfo: {
            airline: 'MockAir',
            flightNumber: 'MA123',
            departureTime: '10:00',
            arrivalTime: '12:00',
            origin: 'JFK',
            destination: 'LAX',
            duration: '2h',
            stops: 0,
          },
          vendors: [{ price: 150 }],
        }],
        source: 'mock',
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/flights-free')
        .send({ origin: 'JFK' });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'All fields are required' });
    });

    it('should return 401 if not authenticated', async () => {
      app.use((req, res, next) => {
        req.user = null;
        next();
      });
      const response = await request(app)
        .post('/api/flights-free')
        .send({ origin: 'JFK', destination: 'LAX', date: '2025-05-01' });
      expect(response.status).toBe(401);
      expect(response.text).toBe('Unauthorized');
    });
  });
});