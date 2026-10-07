import os
import re

file_path = 'frontend/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the Post rendering to show the SNS URLs and the badge
sns_badge_ui = """
                        {/* SNS 홍보 뱃지 */}
                        {(post.cafeUrl1 || post.cafeUrl2 || post.snsUrl1 || post.snsUrl2 || post.snsUrl3) && (
                          <div className="absolute top-4 right-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse">
                            🎁 SNS 홍보등록
                          </div>
                        )}
"""
if "🎁 SNS 홍보등록" not in content:
    content = content.replace('<div className="flex justify-between items-start mb-4">', 
                              '<div className="flex justify-between items-start mb-4">' + sns_badge_ui)

sns_links_ui = """
                        {/* SNS 링크 목록 */}
                        {(post.cafeUrl1 || post.cafeUrl2 || post.snsUrl1 || post.snsUrl2 || post.snsUrl3) && (
                          <div className="mt-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
                            <p className="text-xs font-bold text-rose-600 mb-2">🎁 이벤트 참여 링크 목록</p>
                            <div className="flex flex-col gap-1.5">
                              {post.cafeUrl1 && (
                                <a href={post.cafeUrl1} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate bg-white px-2 py-1.5 rounded border border-rose-50">
                                  🔗 카페 1: {post.cafeUrl1}
                                </a>
                              )}
                              {post.cafeUrl2 && (
                                <a href={post.cafeUrl2} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate bg-white px-2 py-1.5 rounded border border-rose-50">
                                  🔗 카페 2: {post.cafeUrl2}
                                </a>
                              )}
                              {post.snsUrl1 && (
                                <a href={post.snsUrl1} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate bg-white px-2 py-1.5 rounded border border-rose-50">
                                  🔗 SNS 1: {post.snsUrl1}
                                </a>
                              )}
                              {post.snsUrl2 && (
                                <a href={post.snsUrl2} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate bg-white px-2 py-1.5 rounded border border-rose-50">
                                  🔗 SNS 2: {post.snsUrl2}
                                </a>
                              )}
                              {post.snsUrl3 && (
                                <a href={post.snsUrl3} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate bg-white px-2 py-1.5 rounded border border-rose-50">
                                  🔗 SNS 3: {post.snsUrl3}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
"""
if "🎁 이벤트 참여 링크 목록" not in content:
    content = content.replace('{post.receiptSnapshot && (', sns_links_ui + '\n                        {post.receiptSnapshot && (')


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched AdminDashboard.tsx successfully.")
