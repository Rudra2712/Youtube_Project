import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.models.js"
import { Subscription } from "../models/subscription.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }
    // if (userId.toString() === channelId) {
    //     throw new ApiError(400, "You cannot subscribe to your own channel");
    // }//actually we can subscribe to our own channel
    
    const channel = await User.findById(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    // Check if already subscribed
    const existing = await Subscription.findOne({ channel: channelId, subscriber: userId });
    let message = "";
    if (existing) {
        await existing.deleteOne();
        message = `Unsubscribed from channel ${channel.username}`;
    } else {
        await Subscription.create({ channel: channelId, subscriber: userId });
        message = `Subscribed to channel ${channel.username}`;
    }

    return res.status(200).json(new ApiResponse(200, null, message));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    const subscribers = await Subscription.find({ channel: subscriberId }).populate("subscriber", "_id username email");
    return res.status(200).json(new ApiResponse(200, subscribers, "Channel subscribers fetched successfully"));
});


const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { channelId } = req.params;     // ← read channelId, not subscriberId
  
    if (!isValidObjectId(channelId)) {
      throw new ApiError(400, "Invalid channel ID");
    }
  
    // Find all subscriptions where the *subscriber* is the currently logged-in user
    const channels = await Subscription
      .find({ subscriber: channelId })     
      .populate("channel", "_id username email");
  
    return res
      .status(200)
      .json(new ApiResponse(200, channels, "Subscribed channels fetched successfully"));
  });
  

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}