const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    
  },
  imgUrl: {
    type: String,
  },
  bio: {
    type: String,
    

  },
  price: {
    type: Number,
  },
  current: {
  
  type:Number,
  
  
  },
  category:{
  type:String,
  
  }
  
});



module.exports = mongoose.model('Post', userSchema);