import cv2
import numpy as np
from flask import Flask, request, jsonify
from skimage.metrics import structural_similarity as ssim
import urllib.request
import requests
import re

app = Flask(__name__)

def url_to_image(url):
    # Download the image, convert it to a NumPy array, and then read it into OpenCV format
    try:
        resp = urllib.request.urlopen(url)
        image = np.asarray(bytearray(resp.read()), dtype="uint8")
        image = cv2.imdecode(image, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        print(f"Error loading image from {url}: {e}")
        return None

def calculate_ssim(img1, img2):
    # Resize to same dimensions
    img1 = cv2.resize(img1, (512, 512))
    img2 = cv2.resize(img2, (512, 512))
    
    # Convert to grayscale
    grayA = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    grayB = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    score, _ = ssim(grayA, grayB, full=True)
    return score

def calculate_histogram(img1, img2):
    img1 = cv2.resize(img1, (512, 512))
    img2 = cv2.resize(img2, (512, 512))
    
    hist1 = cv2.calcHist([img1], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    cv2.normalize(hist1, hist1)
    
    hist2 = cv2.calcHist([img2], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    cv2.normalize(hist2, hist2)
    
    score = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
    return max(0, score) # Ensure positive

def extract_similarity_percentage_regex(html_content):
    pattern1 = r"Similarity of pictures:.*?<span[^>]*>(\d+(?:\.\d+)?)\s*%"
    match = re.search(pattern1, html_content, re.DOTALL)
    if match:
        return float(match.group(1))

    pattern2 = r"Similarity of pictures:.*?(\d+(?:\.\d+)?)\s*%"
    match = re.search(pattern2, html_content, re.DOTALL)
    if match:
        return float(match.group(1))

    pattern3 = r"<span[^>]*font-size:\s*48px[^>]*>(\d+(?:\.\d+)?)\s*%"
    match = re.search(pattern3, html_content)
    if match:
        return float(match.group(1))

    return None

def get_imgonline_similarity(img1_url, img2_url):
    try:
        img1_bytes = urllib.request.urlopen(img1_url).read()
        img2_bytes = urllib.request.urlopen(img2_url).read()
        
        url = "https://www.imgonline.com.ua/eng/similarity-percent-result.php"
        files = {
            'uploadfile': ('img1.jpg', img1_bytes),
            'uploadfile2': ('img2.jpg', img2_bytes)
        }
        
        response = requests.post(url, files=files, timeout=60)
        sim = extract_similarity_percentage_regex(response.text)
        return sim
    except Exception as e:
        print(f"Error fetching imgonline similarity: {e}")
        return None

@app.route('/api/similarity', methods=['POST'])
def similarity():
    data = request.json
    original_url = data.get('original_url')
    submitted_url = data.get('submitted_url')

    if not original_url or not submitted_url:
        return jsonify({"error": "Missing image URLs"}), 400

    img1 = url_to_image(original_url)
    img2 = url_to_image(submitted_url)

    if img1 is None or img2 is None:
        return jsonify({"error": "Failed to load one or both images"}), 500

    ssim_score = calculate_ssim(img1, img2)
    hist_score = calculate_histogram(img1, img2)
    
    # Use imgonline for the definitive external score if available
    imgonline_score = get_imgonline_similarity(original_url, submitted_url)
    
    if imgonline_score is not None:
        final_score = imgonline_score
    else:
        # Fallback to local combined score if imgonline fails
        final_score = (ssim_score * 0.5 + hist_score * 0.5) * 100

    return jsonify({
        "similarity_score": final_score,
        "breakdown": {
            "ssim": ssim_score,
            "histogram": hist_score,
            "imgonline": imgonline_score
        }
    })

if __name__ == '__main__':
    app.run(port=8000, debug=True)
