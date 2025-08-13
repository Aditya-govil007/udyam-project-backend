const request = require('supertest');
const app = require('./server'); // Path is correct now as both are in the same folder

describe('POST /api/submit', () => {
  it('should return a 400 error for an invalid Aadhaar number', async () => {
    const res = await request(app)
      .post('/api/submit')
      .send({
        aadhaarNumber: '12345', // Invalid Aadhaar (5 digits)
        panNumber: 'ABCDE1234F' // Valid PAN
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Invalid Aadhaar number');
  });

  it('should return a 400 error for an invalid PAN number', async () => {
    const res = await request(app)
      .post('/api/submit')
      .send({
        aadhaarNumber: '123456789012', // Valid Aadhaar
        panNumber: 'invalidpan'       // Invalid PAN
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Invalid PAN number');
  });

  it('should return a 200 for valid Aadhaar and PAN numbers', async () => {
    const res = await request(app)
      .post('/api/submit')
      .send({
        aadhaarNumber: '123456789012', // Valid Aadhaar
        panNumber: 'ABCDE1234F'       // Valid PAN
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('Form Submitted successfully!');
  });
});