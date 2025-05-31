import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinery.js";
import { ApiResponse } from "../utils/ApiResponse.js";





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
    console.log("Email:", email);

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

    // 4. Check for images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // 5. Upload images to Cloudinary (avatar and coverImage)
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

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

export { registerUser }

