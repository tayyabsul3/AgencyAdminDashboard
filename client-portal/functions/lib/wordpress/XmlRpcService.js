/**
 * WordPress XML-RPC Service
 * Fallback service for when REST API is not available
 */

const axios = require('axios');

class WordPressXmlRpcService {
  constructor(siteUrl, username, password, options = {}) {
    this.siteUrl = siteUrl.replace(/\/$/, ''); // Remove trailing slash
    this.username = username;
    this.password = password;
    this.xmlrpcUrl = `${this.siteUrl}/xmlrpc.php`;
    this.blogId = 1; // Default blog ID for single WordPress installations
    this.logger = options.logger || console;
  }

  /**
   * Create XML-RPC request payload
   */
  createXmlRpcRequest(methodName, params = []) {
    const xmlParams = params.map(param => this.paramToXml(param));

    return `<?xml version="1.0"?>
<methodCall>
    <methodName>${methodName}</methodName>
    <params>
        ${xmlParams.join('\n        ')}
    </params>
</methodCall>`;
  }

  /**
   * Convert parameter to XML format
   */
  paramToXml(param) {
    if (typeof param === 'string') {
      return `<param><value><string>${this.escapeXml(param)}</string></value></param>`;
    } else if (typeof param === 'number') {
      return `<param><value><int>${param}</int></value></param>`;
    } else if (typeof param === 'boolean') {
      return `<param><value><boolean>${param ? '1' : '0'}</boolean></value></param>`;
    } else if (param instanceof Buffer) {
      return `<param><value><base64>${param.toString('base64')}</base64></value></param>`;
    } else if (typeof param === 'object' && param !== null) {
      const structMembers = Object.entries(param).map(([key, value]) => {
        let valueXml;
        if (typeof value === 'string') {
          valueXml = `<string>${this.escapeXml(value)}</string>`;
        } else if (typeof value === 'number') {
          valueXml = `<int>${value}</int>`;
        } else if (typeof value === 'boolean') {
          valueXml = `<boolean>${value ? '1' : '0'}</boolean>`;
        } else if (value instanceof Buffer) {
          valueXml = `<base64>${value.toString('base64')}</base64>`;
        } else {
          valueXml = `<string>${this.escapeXml(String(value))}</string>`;
        }
        return `<member><name>${key}</name><value>${valueXml}</value></member>`;
      }).join('');
      return `<param><value><struct>${structMembers}</struct></value></param>`;
    }
    return `<param><value><string>${this.escapeXml(String(param))}</string></value></param>`;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Parse XML-RPC response
   */
  parseXmlRpcResponse(xmlResponse) {
    if (xmlResponse.includes('<fault>')) {
      // Extract fault message
      const faultMatch = xmlResponse.match(/<member><name>faultString<\/name><value><string>(.*?)<\/string>/);
      const faultCodeMatch = xmlResponse.match(/<member><name>faultCode<\/name><value><int>(.*?)<\/int>/);
      
      const message = faultMatch ? faultMatch[1] : 'XML-RPC fault';
      const code = faultCodeMatch ? faultCodeMatch[1] : 'unknown';
      
      throw new Error(`XML-RPC Error ${code}: ${message}`);
    }
    
    return xmlResponse;
  }

  /**
   * Make XML-RPC request
   */
  async makeXmlRpcRequest(methodName, params = []) {
    const xmlPayload = this.createXmlRpcRequest(methodName, params);
    
    this.logger.debug('XML-RPC Request', {
      method: methodName,
      url: this.xmlrpcUrl,
      params: params.length
    });

    try {
      const response = await axios.post(this.xmlrpcUrl, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml',
          'User-Agent': 'QueryFuel-WordPress-Integration/1.0'
        },
        timeout: 30000
      });

      this.parseXmlRpcResponse(response.data);
      return response.data;
    } catch (error) {
      if (error.message.startsWith('XML-RPC Error')) {
        throw error;
      }
      throw new Error(`XML-RPC request failed: ${error.message}`);
    }
  }

  /**
   * Test XML-RPC connection
   */
  async testConnection() {
    try {
      const response = await this.makeXmlRpcRequest('wp.getUsersBlogs', [
        this.username,
        this.password
      ]);

      return {
        success: true,
        method: 'xmlrpc',
        siteInfo: {
          name: 'WordPress Site (XML-RPC)',
          url: this.siteUrl,
          xmlrpcUrl: this.xmlrpcUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'XMLRPC_AUTH_FAILED',
          message: error.message
        }
      };
    }
  }

  /**
   * Upload media file via XML-RPC
   */
  async uploadMedia(fileData, options = {}) {
    if (!options.filename) {
      throw new Error('Filename is required for media upload');
    }

    if (!options.mimeType) {
      throw new Error('MIME type is required for media upload');
    }

    // Convert file data to buffer if needed
    let fileBuffer;
    if (typeof fileData === 'string') {
      const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else if (Buffer.isBuffer(fileData)) {
      fileBuffer = fileData;
    } else {
      throw new Error('File data must be a Buffer or base64 string');
    }

    const uploadData = {
      name: options.filename,
      type: options.mimeType,
      bits: fileBuffer,
      overwrite: false
    };

    try {
      const response = await this.makeXmlRpcRequest('wp.uploadFile', [
        this.blogId,
        this.username,
        this.password,
        uploadData
      ]);

      // Parse the response to extract media info
      const urlMatch = response.match(/<name>url<\/name><value><string>(.*?)<\/string>/);
      const idMatch = response.match(/<name>id<\/name><value><string>(\d+)<\/string>/);
      const fileMatch = response.match(/<name>file<\/name><value><string>(.*?)<\/string>/);

      return {
        id: idMatch ? parseInt(idMatch[1]) : null,
        url: urlMatch ? urlMatch[1] : null,
        filename: fileMatch ? fileMatch[1] : options.filename,
        mimeType: options.mimeType,
        title: options.title || options.filename,
        altText: options.altText || '',
        uploadDate: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Media upload failed: ${error.message}`);
    }
  }

  /**
   * Create a new post via XML-RPC
   */
  async createPost(postData, options = {}) {
    const post = {
      post_title: postData.title || 'Untitled Post',
      post_content: postData.content || '',
      post_excerpt: postData.excerpt || '',
      post_status: postData.status || 'draft',
      post_type: 'post'
    };

    // Add featured image if provided
    if (options.featuredImageId) {
      post.post_thumbnail = options.featuredImageId;
    }

    // Add categories if provided
    if (postData.categories && Array.isArray(postData.categories)) {
      post.terms_names = {
        category: postData.categories
      };
    }

    // Add tags if provided
    if (postData.tags && Array.isArray(postData.tags)) {
      post.terms_names = post.terms_names || {};
      post.terms_names.post_tag = postData.tags;
    }

    try {
      const response = await this.makeXmlRpcRequest('wp.newPost', [
        this.blogId,
        this.username,
        this.password,
        post
      ]);

      // Extract post ID from response - XML-RPC returns just the ID as a string
      const postIdMatch = response.match(/<string>(\d+)<\/string>/);
      const postId = postIdMatch ? parseInt(postIdMatch[1]) : null;

      if (!postId) {
        throw new Error('Could not extract post ID from response');
      }

      return {
        id: postId,
        title: post.post_title,
        url: `${this.siteUrl}/?p=${postId}`,
        editUrl: `${this.siteUrl}/wp-admin/post.php?post=${postId}&action=edit`,
        status: post.post_status
      };
    } catch (error) {
      throw new Error(`Post creation failed: ${error.message}`);
    }
  }

  /**
   * Get categories via XML-RPC
   */
  async getCategories() {
    try {
      this.logger.info('Fetching categories via XML-RPC...');
      
      // Try the more standard wp.getCategories method first
      let response;
      try {
        response = await this.makeXmlRpcRequest('wp.getCategories', [
          this.blogId,
          this.username,
          this.password
        ]);
      } catch (error) {
        // If wp.getCategories fails, try the older mt.getCategoryList method
        this.logger.debug('wp.getCategories failed, trying mt.getCategoryList...', { error: error.message });
        response = await this.makeXmlRpcRequest('mt.getCategoryList', [
          this.blogId,
          this.username,
          this.password
        ]);
      }

      // Parse categories from XML response
      const categories = [];
      
      // Look for category data in the XML response
      const categoryMatches = response.matchAll(/<struct>[\s\S]*?<\/struct>/g);
      
      for (const match of categoryMatches) {
        const categoryXml = match[0];
        
        // Try different field name patterns for different XML-RPC methods
        let idMatch = categoryXml.match(/<name>categoryId<\/name><value><string>([^<]+)<\/string>/) ||
                     categoryXml.match(/<name>term_id<\/name><value><string>([^<]+)<\/string>/) ||
                     categoryXml.match(/<name>categoryId<\/name><value><int>([^<]+)<\/int>/) ||
                     categoryXml.match(/<name>term_id<\/name><value><int>([^<]+)<\/int>/);
                     
        let nameMatch = categoryXml.match(/<name>categoryName<\/name><value><string>([^<]+)<\/string>/) ||
                       categoryXml.match(/<name>name<\/name><value><string>([^<]+)<\/string>/);
                       
        const slugMatch = categoryXml.match(/<name>slug<\/name><value><string>([^<]+)<\/string>/);
        const countMatch = categoryXml.match(/<name>count<\/name><value><int>([^<]+)<\/int>/);
        const parentMatch = categoryXml.match(/<name>parent<\/name><value><string>([^<]+)<\/string>/);
        
        if (idMatch && nameMatch) {
          categories.push({
            id: parseInt(idMatch[1]),
            name: this.unescapeXml(nameMatch[1]),
            slug: slugMatch ? this.unescapeXml(slugMatch[1]) : '',
            count: countMatch ? parseInt(countMatch[1]) : 0,
            parent: parentMatch ? parseInt(parentMatch[1]) : 0
          });
        }
      }

      // If no categories found, add default "Uncategorized"
      if (categories.length === 0) {
        categories.push({
          id: 1,
          name: 'Uncategorized',
          slug: 'uncategorized',
          count: 0,
          parent: 0
        });
      }

      // Sort categories alphabetically
      categories.sort((a, b) => a.name.localeCompare(b.name));

      this.logger.info('Categories fetched successfully via XML-RPC', { 
        count: categories.length,
        categories: categories.slice(0, 5).map(c => c.name)
      });

      return {
        success: true,
        categories: categories
      };
    } catch (error) {
      this.logger.error('Failed to fetch categories via XML-RPC', { error: error.message });
      
      // Return a fallback with just "Uncategorized" instead of failing completely
      this.logger.info('Returning fallback categories due to XML-RPC error');
      return {
        success: true,
        categories: [{
          id: 1,
          name: 'Uncategorized',
          slug: 'uncategorized',
          count: 0,
          parent: 0
        }]
      };
    }
  }

  /**
   * Get user profile via XML-RPC
   */
  async getUserProfile() {
    try {
      const response = await this.makeXmlRpcRequest('wp.getProfile', [
        this.blogId,
        this.username,
        this.password
      ]);

      // Parse user info from XML response
      const userIdMatch = response.match(/<name>user_id<\/name><value><string>([^<]+)<\/string>/);
      const displayNameMatch = response.match(/<name>display_name<\/name><value><string>([^<]+)<\/string>/);
      const emailMatch = response.match(/<name>user_email<\/name><value><string>([^<]+)<\/string>/);

      return {
        id: userIdMatch ? userIdMatch[1] : null,
        username: this.username,
        displayName: displayNameMatch ? displayNameMatch[1] : this.username,
        email: emailMatch ? emailMatch[1] : null
      };
    } catch (error) {
      throw new Error(`Could not get user profile: ${error.message}`);
    }
  }
}

module.exports = WordPressXmlRpcService;