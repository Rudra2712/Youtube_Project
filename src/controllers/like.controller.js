import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    // Validate videoId parameter
    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if video exists
    const Video = mongoose.model("Video");
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if user has already liked the video
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId
    });

    let result;
    let message;

    if (existingLike) {
        // Unlike the video
        await Like.findByIdAndDelete(existingLike._id);
        result = { liked: false };
        message = "Video unliked successfully";
    } else {
        // Like the video
        const newLike = await Like.create({
            video: videoId,
            likedBy: userId
        });
        result = { liked: true, likeId: newLike._id };
        message = "Video liked successfully";
    }

    return res.status(200).json(
        new ApiResponse(200, result, message)
    );
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params

    // Validate commentId parameter
    if (!commentId || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID provided");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if comment exists
    const Comment = mongoose.model("Comment");
    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if user has already liked the comment
    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: userId
    });

    let result;
    let message;

    if (existingLike) {
        // Unlike the comment
        await Like.findByIdAndDelete(existingLike._id);
        result = { liked: false };
        message = "Comment unliked successfully";
    } else {
        // Like the comment
        const newLike = await Like.create({
            comment: commentId,
            likedBy: userId
        });
        result = { liked: true, likeId: newLike._id };
        message = "Comment liked successfully";
    }

    return res.status(200).json(
        new ApiResponse(200, result, message)
    );
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params

    // Validate tweetId parameter
    if (!tweetId || !isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID provided");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if tweet exists
    const Tweet = mongoose.model("Tweet");
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    // Check if user has already liked the tweet
    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    });

    let result;
    let message;

    if (existingLike) {
        // Unlike the tweet
        await Like.findByIdAndDelete(existingLike._id);
        result = { liked: false };
        message = "Tweet unliked successfully";
    } else {
        // Like the tweet
        const newLike = await Like.create({
            tweet: tweetId,
            likedBy: userId
        });
        result = { liked: true, likeId: newLike._id };
        message = "Tweet liked successfully";
    }

    return res.status(200).json(
        new ApiResponse(200, result, message)
    );
})

const getLikedVideos = asyncHandler(async (req, res) => {
    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Get all likes for videos by the current user
    const likedVideos = await Like.find({
        likedBy: userId,
        video: { $exists: true, $ne: null } // Only get likes where video field exists and is not null
    })
    .populate({
        path: "video",
        select: "title description thumbnail duration views owner createdAt",
        populate: {
            path: "owner",
            select: "username fullName avatar"
        }
    })
    .populate("likedBy", "username fullName avatar")
    .sort({ createdAt: -1 }); // Sort by most recent likes first

    if (!likedVideos) {
        throw new ApiError(500, "Error while fetching liked videos");
    }

    // Extract video data from likes
    const videos = likedVideos.map(like => ({
        ...like.video.toObject(),
        likeId: like._id,
        likedAt: like.createdAt
    }));

    return res.status(200).json(
        new ApiResponse(200, videos, "Liked videos fetched successfully")
    );
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}