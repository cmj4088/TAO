import axios from "axios";

const API_BASE = "http://localhost:8002";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

export default client;
