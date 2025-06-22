import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.models.js"
import { User } from "../models/user.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinery.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query;

    // Build filter
    const filter = {};
    if (query) {
        filter.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ];
    }
    if (userId && isValidObjectId(userId)) {
        filter.owner = userId;
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortType === "asc" ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const perPage = parseInt(limit);

    // Query videos
    const [videos, total] = await Promise.all([
        Video.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(perPage),
        Video.countDocuments(filter)
    ]);

    return res.status(200).json(
        new ApiResponse(200, {
            videos,
            total,
            page: parseInt(page),
            limit: perPage,
            totalPages: Math.ceil(total / perPage)
        }, "Videos fetched successfully")
    );
});

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

    // 8. check if video is created
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
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    return res.status(200).json(
        new ApiResponse(200, video, "Video fetched successfully")
    );
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Update fields if provided
    if (title) video.title = title;
    if (description) video.description = description;

    // Handle thumbnail update (file upload or direct URL)
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    if (thumbnailLocalPath) {
        // Upload new thumbnail to Cloudinary
        const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if (!uploadedThumbnail) {
            throw new ApiError(400, "Thumbnail upload failed");
        }
        video.thumbnail = uploadedThumbnail.url;
    } else if (req.body.thumbnail) {
        // Use thumbnail from request body (URL)
        video.thumbnail = req.body.thumbnail;
    }

    await video.save();

    return res.status(200).json(
        new ApiResponse(200, video, "Video updated successfully")
    );
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findByIdAndDelete(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found or already deleted");
    }

    return res.status(200).json(
        new ApiResponse(200, null, "Video deleted successfully")
    );
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res.status(200).json(
        new ApiResponse(200, video, `Video publish status toggled to ${video.isPublished ? "published" : "unpublished"}`)
    );
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}