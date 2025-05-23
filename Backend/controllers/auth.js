const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

exports.signup = async (req, res, next) => {
	const errors = validationResult(req);
	try {
		if (!errors.isEmpty()) {
			const error = new Error('Validation Failed!');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		const email = req.body.email;
		const name = req.body.name;
		const password = req.body.password;

		const hashedPw = await bcrypt.hash(password, 12);

		const user = new User({
			email: email,
			password: hashedPw,
			name: name,
		});
		const result = await user.save();

		res.status(201).json({ message: 'User Created!', userId: result._id });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.login = async (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;
	let loadedUser;
	try {
		const user = await User.findOne({ email: email });

		if (!user) {
			const error = new Error('A user with this email could not be found.');
			error.statusCode = 401;
			throw error;
		}
		loadedUser = user;
		const isEqual = await bcrypt.compare(password, user.password);

		if (!isEqual) {
			const error = new Error('Wrong Password!');
			error.statusCode = 401;
			throw error;
		}
		const token = jwt.sign(
			{
				email: loadedUser.email,
				userId: loadedUser._id.toString(),
			},
			process.env.JWT_SECRET,
			{ expiresIn: '1h' }
		); // Generating the JWTtoken if the credentials are correct
		res.status(200).json({ token: token, userId: loadedUser._id.toString() });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
