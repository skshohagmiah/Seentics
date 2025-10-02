import Website from '../../models/Website.js';

// Get website by domain (for public route validation)
export const getWebsiteByDomain = async (req, res) => {
    try {
      const { domain } = req.params;
      
      const website = await Website.findOne({ 
        domain: domain,
        isActive: true 
      }).populate('userId', 'id email plan status');

      if (!website) {
        return res.status(404).json({
          success: false,
          message: 'Website not found'
        });
      }

      // Return website data for cache
      const websiteData = {
        id: website._id.toString(),
        siteId: website.siteId,
        domain: website.domain,
        userId: website.userId._id.toString(),
        isActive: website.isActive,
        plan: website.userId.plan || 'free',
        userStatus: website.userId.status || 'active'
      };

      res.json(websiteData);
    } catch (error) {
      console.error('Get website by domain error:', error);
      res.status(500).json({
        message: 'Internal server error'
      });
    }
};

// Get website by siteId (for public route validation)
export const getWebsiteBySiteId = async (req, res) => {
    try {
      const { siteId } = req.params;
      
      const website = await Website.findOne({ 
        siteId: siteId,
        isActive: true 
      }).populate('userId', 'id email plan status');

      if (!website) {
        return res.status(404).json({
          success: false,
          message: 'Website not found'
        });
      }

      // Return website data for cache including allowed origins
      const websiteData = {
        id: website._id.toString(),
        siteId: website.siteId,
        domain: website.domain,
        userId: website.userId._id.toString(),
        isActive: website.isActive,
        plan: website.userId.plan || 'free',
        userStatus: website.userId.status || 'active',
        allowedOrigins: website.settings?.allowedOrigins || [website.domain]
      };

      res.json(websiteData);
    } catch (error) {
      console.error('Get website by siteId error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
};

// Get website by ID (for ownership validation)
export const getWebsiteById = async (req, res) => {
    try {
      const { websiteId } = req.params;
      
      const website = await Website.findOne({ 
        _id: websiteId,
        isActive: true 
      }).populate('userId', 'id email plan status');

      if (!website) {
        return res.status(404).json({
          success: false,
          message: 'Website not found'
        });
      }

      // Return website data for cache
      const websiteData = {
        id: website._id.toString(),
        siteId: website.siteId,
        domain: website.domain,
        userId: website.userId._id.toString(),
        isActive: website.isActive,
        plan: website.userId.plan || 'free',
        userStatus: website.userId.status || 'active'
      };

      res.json(websiteData);
    } catch (error) {
      console.error('Get website by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
};

// Validate website with origin checking (for tracking endpoints)
export const validateWebsiteWithOrigin = async (req, res) => {
    try {
      const { websiteId, domain } = req.body;
      const requestOrigin = req.headers.origin || req.headers.referer;
      
      // Find website by ID or domain
      let website;
      if (websiteId) {
        website = await Website.findOne({ 
          siteId: websiteId,
          isActive: true 
        }).populate('userId', 'id email plan status');
      } else if (domain) {
        website = await Website.findOne({ 
          domain: domain,
          isActive: true 
        }).populate('userId', 'id email plan status');
      }

      if (!website) {
        return res.status(404).json({
          success: false,
          message: 'Website not found'
        });
      }

      // Extract origin domain from request
      let originDomain = '';
      if (requestOrigin) {
        try {
          const url = new URL(requestOrigin);
          originDomain = url.hostname;
        } catch (e) {
          // Fallback for malformed origins
          originDomain = requestOrigin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
        }
      }

      // Check if origin is allowed
      const allowedOrigins = website.settings?.allowedOrigins || [website.domain];
      const isOriginAllowed = allowedOrigins.some(allowed => {
        // Normalize domains for comparison
        const normalizedAllowed = allowed.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
        return normalizedAllowed === originDomain || 
               normalizedAllowed === website.domain ||
               originDomain === website.domain;
      });

      if (!isOriginAllowed && originDomain !== '') {
        return res.status(403).json({
          success: false,
          message: 'Origin not allowed for this website',
          data: {
            requestOrigin: originDomain,
            allowedOrigins: allowedOrigins,
            websiteDomain: website.domain
          }
        });
      }

      // Return validated website data
      const websiteData = {
        websiteId: website._id.toString(),
        siteId: website.siteId,
        domain: website.domain,
        websiteName: website.name,
        userId: website.userId._id.toString(),
        isActive: website.isActive,
        isVerified: website.isVerified,
        plan: website.userId.plan || 'free',
        userStatus: website.userId.status || 'active',
        allowedOrigins: allowedOrigins,
        originValidated: true
      };

      res.json({
        success: true,
        data: websiteData
      });
    } catch (error) {
      console.error('Validate website with origin error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
};