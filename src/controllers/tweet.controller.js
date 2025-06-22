import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const {content, video} = req.body

    // Validate tweet content
    if (!content || content.trim().length === 0) {
        throw new ApiError(400, "Tweet content is required");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Validate video ID if provided
    if (video && !isValidObjectId(video)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    // Check if video exists if video ID is provided
    if (video) {
        const Video = mongoose.model("Video");
        const videoExists = await Video.findById(video);
        if (!videoExists) {
            throw new ApiError(404, "Video not found");
        }
    }

    // Create the tweet
    const tweet = await Tweet.create({
        content: content.trim(),
        video: video || undefined, // Only set if video is provided
        owner: userId
    });

    if (!tweet) {
        throw new ApiError(500, "Error while creating tweet");
    }

    // Fetch the created tweet with populated data
    const createdTweet = await Tweet.findById(tweet._id)
        .populate("owner", "username fullName avatar")
        .populate("video", "title thumbnail");

    if (!createdTweet) {
        throw new ApiError(500, "Error while fetching created tweet");
    }

    return res.status(201).json(
        new ApiResponse(201, createdTweet, "Tweet created successfully")
    ); 
})

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID provided");
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Get tweets for the user with populated data
    const tweets = await Tweet.find({ owner: userId })
        .populate("owner", "username fullName avatar")
        .populate("video", "title thumbnail")
        .sort({ createdAt: -1 }); // Sort by newest first

    return res.status(200).json(
        new ApiResponse(200, tweets, "User tweets fetched successfully")
    );
})

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content, video } = req.body;

    // Validate tweet ID
    if (!tweetId || !isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID provided");
    }

    // Validate content if provided
    if (content !== undefined && (content.trim().length === 0)) {
        throw new ApiError(400, "Tweet content cannot be empty");
    }

    // Validate video ID if provided
    if (video && !isValidObjectId(video)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    // Find the tweet
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    // Check if current user is the owner of the tweet
    const currentUserId = req.user?._id;
    if (tweet.owner.toString() !== currentUserId.toString()) {
        throw new ApiError(403, "You can only update your own tweets");
    }

    // Check if video exists if video ID is provided
    if (video) {
        const Video = mongoose.model("Video");
        const videoExists = await Video.findById(video);
        if (!videoExists) {
            throw new ApiError(404, "Video not found");
        }
    }

    // Update the tweet
    const updateFields = {};
    if (content !== undefined) {
        updateFields.content = content.trim();
    }
    if (video !== undefined) {
        updateFields.video = video || null; // Set to null if empty string, otherwise set the video ID
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        { $set: updateFields },
        { new: true }
    ).populate("owner", "username fullName avatar")
     .populate("video", "title thumbnail");

    if (!updatedTweet) {
        throw new ApiError(500, "Error while updating tweet");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedTweet, "Tweet updated successfully")
    );
})

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    // Validate tweet ID
    if (!tweetId || !isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID provided");
    }

    // Find the tweet
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    // Check if current user is the owner of the tweet
    const currentUserId = req.user?._id;
    if (tweet.owner.toString() !== currentUserId.toString()) {
        throw new ApiError(403, "You can only delete your own tweets");
    }

    // Delete the tweet
    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
    if (!deletedTweet) {
        throw new ApiError(500, "Error while deleting tweet");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Tweet deleted successfully")
    );
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}