import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    // Validate required fields
    if (!name || name.trim().length === 0) {
        throw new ApiError(400, "Playlist name is required");
    }

    // Get user from request (set by auth middleware)
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if playlist with same name already exists for this user
    const existingPlaylist = await Playlist.findOne({
        name: name.trim(),
        owner: userId
    });

    if (existingPlaylist) {
        throw new ApiError(409, "Playlist with this name already exists");
    }

    // Create new playlist
    const playlist = await Playlist.create({
        name: name.trim(),
        description: description?.trim() || "",
        owner: userId,
        videos: []
    });

    // Fetch the created playlist with owner details
    const createdPlaylist = await Playlist.findById(playlist._id).populate("owner", "username fullName avatar");

    if (!createdPlaylist) {
        throw new ApiError(500, "Error while creating playlist");
    }

    return res.status(201).json(
        new ApiResponse(201, createdPlaylist, "Playlist created successfully")
    );
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params

    // Validate userId parameter
    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID provided");
    }

    // Get playlists for the specified user
    const playlists = await Playlist.find({ owner: userId })
        .populate("owner", "username fullName avatar")
        .populate({
            path: "videos",
            select: "title description thumbnail duration views owner",
            populate: {
                path: "owner",
                select: "username fullName avatar"
            }
        })
        .sort({ createdAt: -1 }); // Sort by newest first

    if (!playlists) {
        throw new ApiError(500, "Error while fetching playlists");
    }

    return res.status(200).json(
        new ApiResponse(200, playlists, "User playlists fetched successfully")
    );
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    // Validate playlistId parameter
    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID provided");
    }

    // Get playlist by ID with populated data
    const playlist = await Playlist.findById(playlistId)
        .populate("owner", "username fullName avatar")
        .populate({
            path: "videos",
            select: "title description thumbnail duration views owner createdAt",
            populate: {
                path: "owner",
                select: "username fullName avatar"
            }
        });

    // Check if playlist exists
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    return res.status(200).json(
        new ApiResponse(200, playlist, "Playlist fetched successfully")
    );
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {videoId, playlistId} = req.params

    // Validate parameters
    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID provided");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only add videos to your own playlists");
    }

    // Check if video exists
    const Video = mongoose.model("Video");
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if video is already in the playlist
    if (playlist.videos.includes(videoId)) {
        throw new ApiError(409, "Video is already in this playlist");
    }

    // Add video to playlist
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $push: { videos: videoId }
        },
        { new: true }
    ).populate("owner", "username fullName avatar")
    .populate({
        path: "videos",
        select: "title description thumbnail duration views owner",
        populate: {
            path: "owner",
            select: "username fullName avatar"
        }
    });

    if (!updatedPlaylist) {
        throw new ApiError(500, "Error while adding video to playlist");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully")
    );
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {videoId, playlistId} = req.params

    // Validate parameters
    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID provided");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only remove videos from your own playlists");
    }

    // Check if video exists in the playlist
    if (!playlist.videos.includes(videoId)) {
        throw new ApiError(404, "Video is not in this playlist");
    }

    // Remove video from playlist
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: { videos: videoId }
        },
        { new: true }
    ).populate("owner", "username fullName avatar")
    .populate({
        path: "videos",
        select: "title description thumbnail duration views owner",
        populate: {
            path: "owner",
            select: "username fullName avatar"
        }
    });

    if (!updatedPlaylist) {
        throw new ApiError(500, "Error while removing video from playlist");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video removed from playlist successfully")
    );
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    // Validate playlistId parameter
    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID provided");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only delete your own playlists");
    }

    // Delete the playlist
    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

    if (!deletedPlaylist) {
        throw new ApiError(500, "Error while deleting playlist");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Playlist deleted successfully")
    );
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body

    // Validate playlistId parameter
    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID provided");
    }

    // Validate that at least one field is provided for update
    if (!name && !description) {
        throw new ApiError(400, "At least one field (name or description) is required for update");
    }

    // Validate name if provided
    if (name !== undefined && (!name || name.trim().length === 0)) {
        throw new ApiError(400, "Playlist name cannot be empty");
    }

    // Get current user
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Check if playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only update your own playlists");
    }

    // Check for duplicate name if name is being updated
    if (name && name.trim() !== playlist.name) {
        const existingPlaylist = await Playlist.findOne({
            name: name.trim(),
            owner: userId,
            _id: { $ne: playlistId } // Exclude current playlist from duplicate check
        });

        if (existingPlaylist) {
            throw new ApiError(409, "Playlist with this name already exists");
        }
    }

    // Prepare update object
    const updateFields = {};
    if (name !== undefined) {
        updateFields.name = name.trim();
    }
    if (description !== undefined) {
        updateFields.description = description?.trim() || "";
    }

    // Update the playlist
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        updateFields,
        { new: true }
    ).populate("owner", "username fullName avatar")
    .populate({
        path: "videos",
        select: "title description thumbnail duration views owner",
        populate: {
            path: "owner",
            select: "username fullName avatar"
        }
    });

    if (!updatedPlaylist) {
        throw new ApiError(500, "Error while updating playlist");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}