const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { graphqlHTTP } = require('express-graphql');

const { v4: uuidv4 } = require('uuid');
const grapqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('../util/file');

const app = express();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images');
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4());
  },
});

const fileFilter = (req, file, cb) => {
  // File filter for multer object
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());
app.use(multer({ storage: storage, fileFilter: fileFilter }).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images'))); // Serving folder statically for requests going to /images

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}); // Every response sent by the server will have these headers

app.use((error, req, res, next) => {
  // Error handling middleware
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

app.use(auth);

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not authenticated!');
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided!' });
  }

  if (req.body.oldPath) {
    // If an old image existed
    clearImage(req.body.oldPath.replace('/', '\\'));
  }
  filePath = req.file.path.replace('\\', '/');
  return res.status(201).json({ message: 'File stored.', filePath: filePath });
});

app.use(
  // Not using post here to allow get requests to use graphiql
  '/graphql',
  graphqlHTTP({
    schema: grapqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || 'An error occured!';
      const code = err.originalError.code || 500;
      return { message: message, status: code, data: data };
    },
  })
);

mongoose
  .connect(process.env.MONGODB_URI)
  .then((result) => {
    console.log('Connection Established');
    app.listen(8080);
  })
  .catch((err) => {
    console.log(err);
  });
