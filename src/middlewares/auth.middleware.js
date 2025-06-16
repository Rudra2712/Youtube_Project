//tu he kee nahiiii

import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {

        const token = req.cookies?.accessToken || req.headers["authorization"]?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request, no token provided");
        }

        // try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid token, user not found");
        }
        req.user = user;
        next();

        // } catch (jwtError) {
        //     console.error("JWT verification error:", jwtError);
        //     throw new ApiError(401, "Invalid token format or signature");
        // }
    } catch (error) {
        console.error("Auth error:", error);
        throw new ApiError(401, error?.message || "Unauthorized request, invalid token");
    }
})

