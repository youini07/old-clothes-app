import os

file_path = 'frontend/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                ) : boardPosts.length === 0 ? (
                  <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-3">⭐</div><p className="font-medium">등록된 후기가 없습니다.</p></div>
                ) : (
                  <div className="space-y-3">
                    {boardPosts.map((post: any) => (
                      <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">"""

replacement = """                ) : boardPosts.length === 0 ? (
                  <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-3">⭐</div><p className="font-medium">등록된 후기가 없습니다.</p></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {boardPosts.map((post: any) => (
                      <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full flex flex-col">"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced grid layout!")
else:
    print("Target not found.")
