import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinery.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    
})

const publishAVideo = asyncHandler(async (req, res) => {
    // STEPS:
    // 1. Get video details from request body (title, description)
    // 2. Validate required fields
    // 3. Check if video file and thumbnail are uploaded
    // 4. Upload video file to cloudinary
    // 5. Upload thumbnail to cloudinary
    // 6. Get video duration from cloudinary response
    // 7. Create video object in database
    // 8. Remove sensitive fields from response
    // 9. Return success response

    // 1. Get video details from request body
    const { title, description } = req.body;

    // 2. Validation
    if (!title || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    // 3. Check if video file and thumbnail are uploaded
    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required");
    }

    // 4. Upload video file to cloudinary
    const videoFile = await uploadOnCloudinary(videoLocalPath);

    if (!videoFile) {
        throw new ApiError(400, "Video file upload failed");
    }

    // 5. Upload thumbnail to cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail upload failed");
    }

    // 6. Get video duration from cloudinary response
    const duration = videoFile.duration || 0;

    // 7. Create video object in database
    const video = await Video.create({
        title,
        description,
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        duration,
        owner: req.user._id
    });

    // 8. Remove sensitive fields from response
    const createdVideo = await Video.findById(video._id);

    if (!createdVideo) {
        throw new ApiError(500, "Video creation failed");
    }

    // 9. Return success response
    return res.status(201).json(
        new ApiResponse(201, createdVideo, "Video published successfully")
    );
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}