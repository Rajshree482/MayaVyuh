import sys
import json
import urllib.request
import tempfile
import os

# Ensure the local directory is in path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from comparison import load_model, compare_images

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing URL arguments"}))
        sys.exit(1)
        
    url1 = sys.argv[1]
    url2 = sys.argv[2]
    
    tmp1 = None
    tmp2 = None
    
    try:
        # Download images to temporary files
        tmp1 = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        tmp2 = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req1 = urllib.request.Request(url1, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req1, context=ctx) as response, open(tmp1.name, 'wb') as out_file:
            out_file.write(response.read())
            
        req2 = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req2, context=ctx) as response, open(tmp2.name, 'wb') as out_file:
            out_file.write(response.read())
            
        # Load model and compare
        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_models/siamese_model.pth")
        model = load_model(model_path)
        
        score = compare_images(tmp1.name, tmp2.name, model)
        
        # Output clean JSON for the Node.js backend to parse
        print(json.dumps({"similarity_score": float(score)}))
        
    except Exception as e:
        import traceback
        error_details = "".join(traceback.format_exception(type(e), e, e.__traceback__))
        print(json.dumps({"error": str(e), "traceback": error_details}))
        sys.exit(1)
    finally:
        # Cleanup temp files
        try:
            if tmp1 and os.path.exists(tmp1.name):
                os.remove(tmp1.name)
            if tmp2 and os.path.exists(tmp2.name):
                os.remove(tmp2.name)
        except:
            pass

if __name__ == "__main__":
    main()
