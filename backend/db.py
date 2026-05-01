import os
import json
from pymongo import MongoClient

# Use MongoDB by default, fallback to simple JSON file if not available
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://anmolk_db_user:eTJ0EGZcNQASsird@cluster0.emnl8mp.mongodb.net/?appName=Cluster0")

class MockCollection:
    def __init__(self, filename):
        self.filename = filename
        self.data = []
        self._load()

    def _load(self):
        if os.path.exists(self.filename):
            try:
                with open(self.filename, 'r') as f:
                    self.data = json.load(f)
            except:
                self.data = []

    def _save(self):
        with open(self.filename, 'w') as f:
            json.dump(self.data, f)

    def find(self, query=None):
        class Cursor:
            def __init__(self, data):
                self.data = data
            def sort(self, key, direction):
                # Extremely naive sort
                return self.data
            def __iter__(self):
                return iter(self.data)
                
        if not query:
            return Cursor(self.data)
            
        results = []
        for item in self.data:
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                results.append(item)
        return Cursor(results)

    def update_one(self, query, update, upsert=False):
        for idx, item in enumerate(self.data):
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update:
                    self.data[idx].update(update["$set"])
                self._save()
                return
                
        if upsert:
            new_item = {}
            new_item.update(query)
            if "$set" in update:
                new_item.update(update["$set"])
            self.data.append(new_item)
            self._save()

    def insert_one(self, doc):
        # Convert datetime to string for JSON serialization
        import datetime
        doc_copy = doc.copy()
        for k, v in doc_copy.items():
            if isinstance(v, datetime.datetime):
                doc_copy[k] = v.isoformat()
        self.data.append(doc_copy)
        self._save()
        
    def delete_many(self, query):
        new_data = []
        deleted_count = 0
        for item in self.data:
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if not match:
                new_data.append(item)
            else:
                deleted_count += 1
        self.data = new_data
        self._save()
        class DeleteResult:
            def __init__(self, count):
                self.deleted_count = count
        return DeleteResult(deleted_count)

try:
    # Set a slightly longer timeout for remote MongoDB connection
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Force a server call to verify connection
    client.server_info()
    
    print("Successfully connected to MongoDB!")
    db = client.highwatch
    files_collection = db.files
    chats_collection = db.chats
    
except Exception as e:
    print(f"Warning: Could not connect to MongoDB ({e}). Falling back to local JSON files.")
    if not os.path.exists("local_db"):
        os.makedirs("local_db")
        
    files_collection = MockCollection("local_db/files.json")
    chats_collection = MockCollection("local_db/chats.json")
