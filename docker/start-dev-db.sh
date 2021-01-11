#!/bin/bash
set -e

# create volume for the data
echo "Creation du volume"
docker volume create --name badsender -d local

# start docker container
echo "Docker compose"
docker-compose -f docker-compose.yml up -d --remove-orphans
echo "Docker compose end"
# docker-compose logs -f

# # wait for pg to start (1min max)
# RETRIES=10
# until docker exec -i badsender psql -U postgres -c "select 1" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
#   echo "Waiting for postgres server, $((RETRIES--)) remaining attempts..."
#   sleep 6
# done
