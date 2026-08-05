const { GoogleGenAI } = require('@google/genai');

/**
 * AI Content Assistant Service — Platform & Hashtag Tailored Engine
 */

async function generateCaptionSuggestions(promptText, options = {}) {
  const topic = promptText || 'Social media growth';
  const platform = (options.platform || 'instagram').toLowerCase();
  const apiKey = options.customApiKey || process.env.GEMINI_API_KEY;
  
  if (apiKey && apiKey !== 'dummy_key') {
    try {
      let data;
      if (apiKey.startsWith('sk-')) {
        const prompt = `Generate 2 highly engaging social media captions for ${platform} about "${topic}". 
        CRITICAL: The output MUST be in the same language as the topic provided (e.g., if the topic is in Arabic, the captions and hashtags MUST be in Arabic).
        Return ONLY a JSON array of objects with the following keys:
        id (string, e.g., "1", "2"), style (string, e.g., "Professional Insight", "Viral Hook"), caption (string), hashtags (array of strings), bestTime (string, e.g., "6:00 PM").`;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: 'You are a social media expert. Return ONLY valid JSON.' }, { role: 'user', content: prompt }]
          })
        });
        const resData = await response.json();
        if (resData.error) {
          throw new Error(resData.error.message);
        }
        const text = resData.choices?.[0]?.message?.content || '[]';
        data = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      } else {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `Generate 2 highly engaging social media captions for ${platform} about "${topic}". 
          CRITICAL: The output MUST be in the same language as the topic provided (e.g., if the topic is in Arabic, the captions and hashtags MUST be in Arabic).
          Return ONLY a JSON array of objects with the following keys:
          id (string, e.g., "1", "2"), style (string, e.g., "Professional Insight", "Viral Hook"), caption (string), hashtags (array of strings), bestTime (string, e.g., "6:00 PM").`,
          config: { responseMimeType: "application/json" }
        });
        data = JSON.parse(response.text);
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('AI returned an empty array or invalid format.');
      }
      return { topic, platform, suggestions: data };
    } catch (err) {
      console.error('AI Error (generateCaptionSuggestions):', err);
      // Let it fall back
    }
  }

  // Fallback Logic
  return {
    topic,
    platform,
    suggestions: getFallbackCaptions(topic, platform),
  };
}

async function generateAnalyticsInsights(metrics, options = {}) {
  const apiKey = options.customApiKey || process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'dummy_key') {
    try {
      const prompt = `Analyze these 7-day social media metrics: 
      Reach: ${metrics.reach?.current || 0} (${metrics.reach?.change || 0}%), 
      Engagement: ${metrics.engagement?.current || 0} (${metrics.engagement?.change || 0}%). 
      Provide 3 short, actionable, and specific tips to improve these metrics. The tips MUST be in Arabic if requested or default to English.
      Return ONLY a JSON array of strings (the tips).`;
      
      let data;
      if (apiKey.startsWith('sk-')) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: 'You are an analytics expert. Return ONLY valid JSON array of strings.' }, { role: 'user', content: prompt }]
          })
        });
        const resData = await response.json();
        if (resData.error) {
          throw new Error(resData.error.message);
        }
        const text = resData.choices?.[0]?.message?.content || '[]';
        data = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      } else {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        data = JSON.parse(response.text);
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('AI returned empty array or invalid format.');
      }
      return data;
    } catch (err) {
      console.error('AI Error (generateAnalyticsInsights):', err.message);
    }
  }

  // Fallback Tips based on simple logic
  const tips = [];
  if ((metrics.engagement?.change || 0) < 0) {
    tips.push("Your engagement dropped recently. Try asking a question in your next post to encourage comments.");
  } else {
    tips.push("Great engagement! Keep doubling down on the content style you posted this week.");
  }
  
  if ((metrics.reach?.change || 0) < 0) {
    tips.push("Reach is down. Consider using trending audio or reels to tap into new audiences.");
  } else {
    tips.push("Your reach is growing. Now is a good time to introduce a call-to-action to convert viewers to followers.");
  }
  
  tips.push("Post between 6-8 PM for optimal visibility based on your audience timezone.");
  
  return tips.slice(0, 3);
}

async function generateTrendingTopics(platform = 'all', options = {}) {
  const apiKey = options.customApiKey || process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'dummy_key') {
    try {
      const prompt = `Generate 4 currently trending topics or hashtags for social media platform: ${platform}. 
        Return ONLY a JSON array of objects with keys: 
        id (string), trendName (string), platform (string), growthRate (string, e.g., "+45%"), volume (number, e.g., 150000).`;

      let data;
      if (apiKey.startsWith('sk-')) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: 'You are a social media trends expert. Return ONLY valid JSON array.' }, { role: 'user', content: prompt }]
          })
        });
        const resData = await response.json();
        if (resData.error) {
          throw new Error(resData.error.message);
        }
        const text = resData.choices?.[0]?.message?.content || '[]';
        data = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      } else {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        data = JSON.parse(response.text);
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('AI returned empty array or invalid format.');
      }
      return data;
    } catch (err) {
      console.error('AI Error (generateTrendingTopics):', err.message);
    }
  }

  // Fallback Trends
  return [
    { id: '1', trendName: '#AiMarketing2026', platform: platform, growthRate: '+45%', volume: 850000 },
    { id: '2', trendName: '#ShortsViral2026', platform: platform, growthRate: '+88%', volume: 3200000 },
    { id: '3', trendName: '#SocialMediaGrowth', platform: platform, growthRate: '+68%', volume: 1200000 },
    { id: '4', trendName: '#CreatorEconomy', platform: platform, growthRate: '+25%', volume: 500000 },
  ];
}


// --- Helpers ---
function getFallbackCaptions(topic, platform) {
  const cleanTopic = topic.replace(/\s+/g, '');
  if (platform === 'linkedin') {
    return [
      {
        id: '1', style: '💼 Professional Insight',
        caption: `Navigating ${topic} effectively requires strategic alignment.\n\n3 key takeaways for leaders:\n• Consistency over intensity\n• Data-driven decisions\n• Audience engagement\n\nWhat is your strategy this quarter?`,
        hashtags: ['#Leadership', `#${cleanTopic}`, '#ProfessionalDevelopment', '#BusinessStrategy'],
        bestTime: '8:30 AM',
      },
    ];
  } else if (platform === 'tiktok') {
    return [
      {
        id: '1', style: '⚡ Viral Hook & Script Idea',
        caption: `POV: You just discovered the ultimate hack for ${topic} 😱\n\nStop scrolling! Try this 1 trick today and watch your results skyrocket 🚀`,
        hashtags: ['#FYP', '#Viral', `#${cleanTopic}`, '#TikTokHacks', '#Trending'],
        bestTime: '7:00 PM',
      },
    ];
  }
  return [
    {
      id: '1', style: '📸 Visual Storytelling & Engagement',
      caption: `✨ Level up your ${topic} with these easy steps! Swipe left to see the breakdown 📲\n\nSave this post so you don't lose it! ❤️`,
      hashtags: ['#InstagramTips', `#${cleanTopic}`, '#ContentCreator', '#ExplorePage', '#DailyInspiration'],
      bestTime: '6:45 PM',
    },
  ];
}

module.exports = {
  generateCaptionSuggestions,
  generateAnalyticsInsights,
  generateTrendingTopics
};
