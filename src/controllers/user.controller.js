import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinery.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import e from "express";
import mongoose from "mongoose";
import fs from "fs";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefeshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Error generating tokens");
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //STEPS
    //1. get user details 
    //2. validation
    //3. check if user already exists username or email
    //4. check for images,check for avtar
    //5. upload images to cloudinary, avtar
    //6. create user object - create entry in database
    //7. remove password and refresh token from response
    //8. check for user creation 
    //9. return response

    // 1. Get user details from Tailwind
    const { fullName, email, username, password } = req.body
    // console.log("Email:", email); //checks   

    // 2. Validation
    if (
        [fullName, email, username, password].some(field => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // 3. Check if user already exists by username or email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "Username or email already exists");
    }

    // console.log("User does not exist, proceeding with registration...");    //checks

    // 4. Check for images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    // let coverImageLocalPath ;
    // if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    //     coverImageLocalPath = req.files.coverImage[0].path;
    // } 


    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // console.log("Avatar local path:", avatarLocalPath);   //checks

    // 5. Upload images to Cloudinary (avatar and coverImage)
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    // console.log("Avatar uploaded successfully:", avatar.url); //checks

    // 6. Create user object - create entry in database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // 7. Remove password and refresh token from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // 8. Check for user creation
    if (!createdUser) {
        throw new ApiError(500, "User registration failed");
    }

    // 9. Return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );

});

const loginUser = asyncHandler(async (req, res) => {
    //req.body ->data
    //username or email
    //find user by username or email
    // password check
    //access and refresh token generation
    // send cookies

    //req.body ->data
    //username or email
    const { email, username, password } = req.body;
    if (!email && !username) {
        throw new ApiError(400, "Email or username is required")
    }
    //find user by username or email
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    //password check

    const isPasswordVaild = await user.isPasswordCorrect(password);

    if (!isPasswordVaild) {
        throw new ApiError(401, "Invalid password")
    }
    //access and refresh token generation

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    //optional step
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true, // cookie cannot be accessed by client-side scripts
        secure: true,

    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    //If User is sending 
                    //to be sent in cookies explicitly
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "user logged in successfully"
            )
        );
})

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 //this removes the field from document
            }
        },
        {
            new: true,
        }
    )
    const options = {
        httpOnly: true, // cookie cannot be accessed by client-side scripts
        secure: true,
        expires: new Date(Date.now())
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
})

const refreshAccessToken = asyncHandler(async (req, res) => { //refresh token is used to generate a new access token
    
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request, no refresh token provided");
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        )

        const user = await User.findById(decodedToken._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (user?.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "refresh token expired or used");
        }

        const options = {
            httpOnly: true,
            secure: true,
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        RefreshToken: newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token format or signature");
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Password changed successfully")
        );
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"));

})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        { new: true }
    ).select("-password");
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        );
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
    
    try {
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        if (!avatar.url) {
            throw new ApiError(400, "Error while uploading avatar");
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            { new: true }
        ).select("-password");

        return res
            .status(200)
            .json(
                new ApiResponse(200, user, "Avatar updated successfully")
            );
    } catch (error) {
        // Delete the local file if upload fails
        if (avatarLocalPath && fs.existsSync(avatarLocalPath)) {
            fs.unlinkSync(avatarLocalPath);
        }
        throw error;
    }
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is required");
    }

    try {
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);
        if (!coverImage.url) {
            throw new ApiError(400, "Error while uploading cover image");
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            { new: true }
        ).select("-password");

        return res
            .status(200)
            .json(
                new ApiResponse(200, user, "Cover image updated successfully")
            );
    } catch (error) {
        // Delete the local file if upload fails
        if (coverImageLocalPath && fs.existsSync(coverImageLocalPath)) {
            fs.unlinkSync(coverImageLocalPath);
        }
        throw error;
    }
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    const channel = await User.aggregate([
        {
            $match: { //matching the users
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {//counted the subscribers through channel
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {// count the channels subscribed to by the user through subscriber
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: { //adding the fields to the channel
                subsribersCount: {//counting the subscribers
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {//counting the channels subscribed to by the user
                    $size: "$subscribedTo"
                },
                isSubscribed: {// checking if the user is subscribed to the channel
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subsribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ])



    if (!channel?.length) {
        throw new ApiError(404, "Channel not found");
    }
    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "Channel profile fetched successfully")
        );

})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200, user[0]?.watchHistory , "Watch history fetched successfully")
        );
})




export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}
