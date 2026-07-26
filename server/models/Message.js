import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        from:{
            type:String,
            required: true,
        },
        to:{
            type: String,
            required: true,
        },
        message:{
            type:String,
            required: true
        },
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        }
    },
        {timestamps: true}
);

messageSchema.index({ from: 1, to: 1, createdAt: -1 });
messageSchema.index({ to: 1, from: 1, createdAt: -1 });

export default mongoose.model("Message",messageSchema);