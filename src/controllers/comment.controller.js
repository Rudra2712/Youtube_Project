import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate video ID
    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    // Validate pagination parameters
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    
    if (pageNumber < 1 || limitNumber < 1 || limitNumber > 50) {
        throw new ApiError(400, "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 50");
    }

    // Check if video exists
    const Video = mongoose.model("Video");
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Calculate skip value for pagination
    const skip = (pageNumber - 1) * limitNumber;

    // Get comments for the video with pagination and populated data
    const comments = await Comment.find({ video: videoId })
        .populate("owner", "username fullName avatar")
        .populate("video", "title")
        .sort({ createdAt: -1 }) // Sort by newest first
        .skip(skip)
        .limit(limitNumber);

    // Get total count of comments for this video
    const totalComments = await Comment.countDocuments({ video: videoId });

    // Calculate pagination info
    const totalPages = Math.ceil(totalComments / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    return res.status(200).json(
        new ApiResponse(200, {
            comments,
            pagination: {
                currentPage: pageNumber,
                totalPages,
                totalComments,
                hasNextPage,
                hasPrevPage,
                limit: limitNumber
            }
        }, "Video comments fetched successfully")
    );
})

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    // Validate videoId parameter
    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    // Validate comment content
    if (!content || content.trim().length === 0) {
        throw new ApiError(400, "Comment content is required");
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

    // Create the comment
    const comment = await Comment.create({
        content: content.trim(),
        video: videoId,
        owner: userId
    });

    if (!comment) {
        throw new ApiError(500, "Error while creating comment");
    }

    // Fetch the created comment with populated data
    const createdComment = await Comment.findById(comment._id)
        .populate("owner", "username fullName avatar")
        .populate("video", "title");

    if (!createdComment) {
        throw new ApiError(500, "Error while fetching created comment");
    }

    return res.status(201).json(
        new ApiResponse(201, createdComment, "Comment added successfully")
    );
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    // Validate comment ID
    if (!commentId || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID provided");
    }

    // Validate content
    if (!content || content.trim().length === 0) {
        throw new ApiError(400, "Comment content is required");
    }

    // Find the comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if current user is the owner of the comment
    const currentUserId = req.user?._id;
    if (comment.owner.toString() !== currentUserId.toString()) {
        throw new ApiError(403, "You can only update your own comments");
    }

    // Update the comment
    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        { $set: { content: content.trim() } },
        { new: true }
    ).populate("owner", "username fullName avatar")
        .populate("video", "title");

    if (!updatedComment) {
        throw new ApiError(500, "Error while updating comment");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
    );
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    // Validate comment ID
    if (!commentId || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID provided");
    }

    // Find the comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if current user is the owner of the comment
    const currentUserId = req.user?._id;
    if (comment.owner.toString() !== currentUserId.toString()) {
        throw new ApiError(403, "You can only delete your own comments");
    }

    // Delete the comment
    const deletedComment = await Comment.findByIdAndDelete(commentId);
    if (!deletedComment) {
        throw new ApiError(500, "Error while deleting comment");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Comment deleted successfully")
    );
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}