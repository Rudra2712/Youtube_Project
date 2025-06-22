import mongoose from "mongoose"
import { Video } from "../models/video.models.js"
import { Subscription } from "../models/subscription.models.js"
import { Like } from "../models/like.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import asyncHandler  from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // Get current user ID
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Get total videos uploaded by the channel
    const totalVideos = await Video.countDocuments({ owner: userId });

    // Get total views across all videos
    const totalViews = await Video.aggregate([
        { $match: { owner: userId } },
        { $group: { _id: null, totalViews: { $sum: "$views" } } }
    ]);

    // Get total subscribers
    const totalSubscribers = await Subscription.countDocuments({ channel: userId });

    // Get total likes received on all videos
    const totalLikes = await Like.countDocuments({
        video: { $in: await Video.find({ owner: userId }).distinct('_id') }
    });

    // Get recent video stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentVideos = await Video.countDocuments({
        owner: userId,
        createdAt: { $gte: thirtyDaysAgo }
    });

    const recentViews = await Video.aggregate([
        { 
            $match: { 
                owner: userId,
                createdAt: { $gte: thirtyDaysAgo }
            } 
        },
        { $group: { _id: null, totalViews: { $sum: "$views" } } }
    ]);

    // Get video with most views
    const mostViewedVideo = await Video.findOne({ owner: userId })
        .sort({ views: -1 })
        .select("title views thumbnail");

    // Get average views per video
    const averageViews = totalVideos > 0 ? 
        (totalViews[0]?.totalViews || 0) / totalVideos : 0;

    const stats = {
        totalVideos,
        totalViews: totalViews[0]?.totalViews || 0,
        totalSubscribers,
        totalLikes,
        recentVideos,
        recentViews: recentViews[0]?.totalViews || 0,
        averageViews: Math.round(averageViews),
        mostViewedVideo: mostViewedVideo || null
    };

    return res.status(200).json(
        new ApiResponse(200, stats, "Channel stats fetched successfully")
    );
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // Get current user ID
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Get pagination parameters
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Validate pagination parameters
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    
    if (pageNumber < 1 || limitNumber < 1 || limitNumber > 50) {
        throw new ApiError(400, "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 50");
    }

    // Validate sort parameters
    const validSortFields = ["createdAt", "updatedAt", "views", "title"];
    const validSortOrders = ["asc", "desc"];
    
    if (!validSortFields.includes(sortBy)) {
        throw new ApiError(400, "Invalid sort field. Must be one of: createdAt, updatedAt, views, title");
    }
    
    if (!validSortOrders.includes(sortOrder)) {
        throw new ApiError(400, "Invalid sort order. Must be 'asc' or 'desc'");
    }

    // Calculate skip value for pagination
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get videos with pagination and sorting
    const videos = await Video.find({ owner: userId })
        .populate("owner", "username fullName avatar")
        .sort(sortObject)
        .skip(skip)
        .limit(limitNumber);

    // Get total count of videos for this channel
    const totalVideos = await Video.countDocuments({ owner: userId });

    // Get additional stats for each video (likes and comments)
    const videosWithStats = await Promise.all(
        videos.map(async (video) => {
            const likesCount = await Like.countDocuments({ video: video._id });
            
            // Get comments count
            const Comment = mongoose.model("Comment");
            const commentsCount = await Comment.countDocuments({ video: video._id });

            return {
                ...video.toObject(),
                likesCount,
                commentsCount
            };
        })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalVideos / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    return res.status(200).json(
        new ApiResponse(200, {
            videos: videosWithStats,
            pagination: {
                currentPage: pageNumber,
                totalPages,
                totalVideos,
                hasNextPage,
                hasPrevPage,
                limit: limitNumber
            },
            sortInfo: {
                sortBy,
                sortOrder
            }
        }, "Channel videos fetched successfully")
    );
})

export {
    getChannelStats,
    getChannelVideos
}