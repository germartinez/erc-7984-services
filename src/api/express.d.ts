declare global {
  namespace Express {
    interface Request {
      validated?: {
        params?: any;
        query?: any;
        body?: any;
      };
    }
  }
}

export {};
