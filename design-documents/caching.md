### Problem:

We are currently using a free tier database, which has a limit of 1B read operations.
We are currently reading every link from the database everytime a new request is made,
which is increasing our read operations and thus, getting us closer to the free tier limit.

### Solution:

I intend on integrating caching solutions, this will improve our overall
performance (response times) and reduce the number of read operations we make to the database.

### Design:

For the current solution, we will have the cache sit between our users and our database, if

Request -> Cache -> Database -> Cache -> Response

We will be using a _write-through cache_, this means that everytime a new link is created,
we will write that to the cache and then the database and the next time a user requests for that particular link, we will give them the results we have from the cache. This will reduce the number of read operations we make to the database.

Also due to the implementation of write-through cache, we will prevent the initial cache miss before the cache is populated with the data from the database. This will ensure that we do not have to wait for the data to be populated in the cache before we can serve the request. Cache will now be only missed if they are evicted from the cache.

### Cache implementation:

We will be using redis for our caching solution since it is the most readily available
solution for us to use and due to the numerous ways we can hook it up into our current
infrastructure.

### Cache invalidation strategy:

Since links can be updated by the users, we will only invalidate a cache and re-populate when a new update is made.
This will ensure that we always have the latest version of the link in the cache so we will not
be redirecting users or using outdated links.

### Cache eviction strategy:

We will be using the **LFU (Least Frequently Used)** strategy for our cache eviction, this is because we want to keep the most frequently used links in the cache and remove the least frequently used links from the cache. This will ensure that we always have the most frequently used links in the cache and we will not be wasting space in the cache.
