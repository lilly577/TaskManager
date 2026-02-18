const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:      { type: String, required: true, trim: true },
    description:{ type: String, trim: true },
    category:   { type: String, enum: ['Work', 'Personal', 'Study', 'Other'], default: 'Other' },
    priority:   { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    startDate:  { type: Date},
    dueDate:    { type: Date },
    estimatedTime:{ 
        type: Number,
        min: 0,
        default: 0
     }, 
     
    completed:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);