export const usernameController = ( req, res) => {
    const username = req.params.username;
    res.send(`Hello ${username}!!!`);
}

export const searchController = ( req, res) => {
  const query = req.query.keyword;
  res.send(`You searched for: ${query}`);
}   