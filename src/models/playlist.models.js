import mongoose, { Schema } from "mongoose";

const playlistSchema = new Schema({
    content: {
        type: String,
        required: true,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    }
}, { timestamps: true });

export const Playlist = mongoose.model("Playlist", playlistSchema);