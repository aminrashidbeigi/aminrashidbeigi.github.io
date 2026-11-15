// Commits a set of files to one branch in a single commit, through the Git Data API.

export interface GitHubConfig {
  token: string;
  repo: string; // owner/name
  branch: string;
}

export interface FileChange {
  path: string;
  content: string | Uint8Array;
}

export async function commitFiles(cfg: GitHubConfig, message: string, files: FileChange[]): Promise<string> {
  // Blobs do not depend on the branch head, so create them once.
  const tree = [];
  for (const file of files) {
    const blob = await gh<{ sha: string }>(cfg, "POST", "/git/blobs", {
      content: typeof file.content === "string" ? file.content : base64(file.content),
      encoding: typeof file.content === "string" ? "utf-8" : "base64",
    });
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // Retry when someone else pushed between reading the head and moving it.
  for (let attempt = 0; ; attempt++) {
    const ref = await gh<{ object: { sha: string } }>(cfg, "GET", `/git/ref/heads/${cfg.branch}`);
    const head = await gh<{ tree: { sha: string } }>(cfg, "GET", `/git/commits/${ref.object.sha}`);
    const newTree = await gh<{ sha: string }>(cfg, "POST", "/git/trees", { base_tree: head.tree.sha, tree });
    const commit = await gh<{ sha: string }>(cfg, "POST", "/git/commits", {
      message,
      tree: newTree.sha,
      parents: [ref.object.sha],
    });
    try {
      await gh(cfg, "PATCH", `/git/refs/heads/${cfg.branch}`, { sha: commit.sha });
      return commit.sha;
    } catch (err) {
      if (attempt >= 2) throw err;
    }
  }
}

async function gh<T>(cfg: GitHubConfig, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "aminrb-telegram-sync",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
