package utils

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

// SlidingWindowRateLimit implements sliding window rate limiting using Redis sorted sets
func CheckRateLimit(redisClient *redis.Client, key string, limit int, window time.Duration) (bool, int, error) {
	ctx := context.Background()
	now := time.Now().UnixNano()
	windowStart := now - window.Nanoseconds()
	
	// Use Lua script for atomic operations
	luaScript := `
		local key = KEYS[1]
		local now = tonumber(ARGV[1])
		local window_start = tonumber(ARGV[2])
		local limit = tonumber(ARGV[3])
		local window_seconds = tonumber(ARGV[4])
		
		-- Remove expired entries
		redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
		
		-- Count current requests in window
		local current_count = redis.call('ZCARD', key)
		
		-- Check if limit exceeded
		if current_count >= limit then
			return {0, current_count}
		end
		
		-- Add current request
		redis.call('ZADD', key, now, now)
		
		-- Set expiration (window + buffer for cleanup)
		redis.call('EXPIRE', key, window_seconds + 60)
		
		-- Return success and new count
		return {1, current_count + 1}
	`
	
	result, err := redisClient.Eval(ctx, luaScript, []string{key}, 
		now, windowStart, limit, int(window.Seconds())).Result()
	if err != nil {
		return false, 0, err
	}
	
	// Parse result
	resultSlice, ok := result.([]interface{})
	if !ok || len(resultSlice) != 2 {
		return false, 0, fmt.Errorf("unexpected result format")
	}
	
	allowed, _ := resultSlice[0].(int64)
	count, _ := resultSlice[1].(int64)
	
	return allowed == 1, int(count), nil
}

// CheckRateLimitWithBurst implements rate limiting with burst support
func CheckRateLimitWithBurst(redisClient *redis.Client, key string, limit int, window time.Duration, burstLimit int, burstWindow time.Duration) (bool, int, error) {
	// Check burst limit first (shorter window)
	burstKey := key + ":burst"
	burstAllowed, burstCount, err := CheckRateLimit(redisClient, burstKey, burstLimit, burstWindow)
	if err != nil {
		return false, 0, err
	}
	
	if !burstAllowed {
		return false, burstCount, nil
	}
	
	// Check main window limit
	return CheckRateLimit(redisClient, key, limit, window)
}

// Legacy function for backward compatibility - now uses sliding window
func CheckRateLimitFixed(redisClient *redis.Client, key string, limit int, window time.Duration) (bool, int, error) {
	ctx := context.Background()

	// Atomic increment with expiration using Lua script
	luaScript := `
		local count = redis.call('INCR', KEYS[1])
		if count == 1 then
			redis.call('EXPIRE', KEYS[1], ARGV[1])
		end
		return count
	`
	
	count, err := redisClient.Eval(ctx, luaScript, []string{key}, int(window.Seconds())).Int64()
	if err != nil {
		return false, 0, err
	}

	return count <= int64(limit), int(count), nil
}
