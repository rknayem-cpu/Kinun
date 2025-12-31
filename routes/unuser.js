const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,

  },
  address: {
    type: String,
  },
  isVerified:{
  
  type:Boolean,
  default:false,
  
  
  },
  otp:{
  type:Number,
  }

});



module.exports = mongoose.model('Unuser', userSchema);