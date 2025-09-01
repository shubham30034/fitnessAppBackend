const request = require('supertest');
const http = require('http');
const express = require('express');

describe('Health and basic server tests', () => {
  let app;
  let server;

  beforeAll(() => {
    app = express();
    app.get('/health', (req, res) => res.status(200).json({ ok: true }));
    server = http.createServer(app);
    server.listen(0);
  });

  afterAll((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  it('should return 200 on /health', async () => {
    await request(server)
      .get('/health')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(({ body }) => {
        if (!body.ok) throw new Error('Expected ok=true');
      });
  });
});

