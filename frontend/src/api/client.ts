import axios from "axios";

export const API_BASE = "http://10.50.150.176:8006";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

export default client;
